# 学生账号绑定与节次新增修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为学生账号建立显式 `user -> student` 绑定并修复首页在无节次数据时无法新增首个节次的问题。

**Architecture:** 后端在 `users` 表新增可空 `student_id` 外键，由管理员在账号管理页显式绑定学生档案；成绩接口对学生角色自动锁定到 `current_user.student_id`，不再接受外部指定。首页节次弹窗改为同时支持“新增首个节次”和“编辑现有节次”两种模式，继续复用现有节次接口。

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, Ant Design, unittest, Vite

---

### Task 1: 补齐后端数据结构与返回契约

**Files:**
- Create: `backend/alembic/versions/<new_revision>_add_student_id_to_users.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/schemas/auth.py`
- Test: `backend/tests/test_student_account_binding.py`

- [ ] **Step 1: 写后端失败测试，固定 `UserResponse` 与绑定校验的新契约**

```python
import unittest

from app.schemas.auth import UserResponse


class StudentAccountBindingTests(unittest.TestCase):
    def test_user_response_exposes_student_binding_fields(self):
        fields = UserResponse.model_fields
        self.assertIn("student_id", fields)
        self.assertIn("student_name", fields)
        self.assertIn("student_no", fields)
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `python -m unittest tests.test_student_account_binding -v`
Expected: FAIL with missing `student_id` / `student_name` / `student_no` fields on `UserResponse`

- [ ] **Step 3: 增加 `users.student_id` 字段和 schema 返回字段**

```python
class User(Base):
    # ...
    student_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("students.id"),
        nullable=True,
        unique=True,
    )


class UserResponse(BaseModel):
    # ...
    student_id: int | None = None
    student_name: str | None = None
    student_no: str | None = None
```

- [ ] **Step 4: 添加 Alembic 迁移**

```python
def upgrade() -> None:
    op.add_column("users", sa.Column("student_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "users", "students", ["student_id"], ["id"])
    op.create_unique_constraint("uq_users_student_id", "users", ["student_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_student_id", "users", type_="unique")
    op.drop_constraint(None, "users", type_="foreignkey")
    op.drop_column("users", "student_id")
```

- [ ] **Step 5: 再跑测试，确认通过**

Run: `python -m unittest tests.test_student_account_binding -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/user.py backend/app/schemas/auth.py backend/alembic/versions/<new_revision>_add_student_id_to_users.py backend/tests/test_student_account_binding.py
git commit -m "feat: add explicit student binding fields"
```

### Task 2: 固化账号绑定规则与学生成绩身份解析

**Files:**
- Modify: `backend/app/routers/accounts.py`
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/routers/scores.py`
- Test: `backend/tests/test_student_account_binding.py`

- [ ] **Step 1: 写失败测试，锁定“学生账号必须显式绑定”和“成绩接口自动取当前用户 student_id”规则**

```python
from types import SimpleNamespace

from app.routers.scores import _resolve_student_scope_id
from app.routers.accounts import _validate_student_binding


class StudentAccountBindingTests(unittest.TestCase):
    def test_resolve_student_scope_id_uses_bound_student_for_student_role(self):
        user = SimpleNamespace(role="student", student_id=12)
        self.assertEqual(_resolve_student_scope_id(user, requested_student_id=99), 12)

    def test_resolve_student_scope_id_rejects_unbound_student(self):
        user = SimpleNamespace(role="student", student_id=None)
        with self.assertRaisesRegex(ValueError, "未绑定学生档案"):
            _resolve_student_scope_id(user, requested_student_id=None)
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `python -m unittest tests.test_student_account_binding -v`
Expected: FAIL because `_resolve_student_scope_id` / `_validate_student_binding` do not exist yet

- [ ] **Step 3: 提取最小 helper 并让路由复用**

```python
def _resolve_student_scope_id(current_user: User, requested_student_id: int | None) -> int | None:
    if current_user.role != "student":
        return requested_student_id
    if current_user.student_id is None:
        raise ValueError("当前学生账号未绑定学生档案，请联系管理员")
    return current_user.student_id


def _validate_student_binding(role: str, student_id: int | None, existing_user_id: int | None, db: Session) -> None:
    if role != "student" and student_id is not None:
        raise HTTPException(status_code=400, detail="仅学生账号可绑定学生档案")
    # check student exists and binding uniqueness
```

- [ ] **Step 4: 在路由中接入 helper，最小改动替换旧逻辑**

```python
resolved_student_id = _resolve_student_scope_id(current_user, student_id)
if resolved_student_id is not None:
    student_query = student_query.filter(Student.id == resolved_student_id)
```

- [ ] **Step 5: 让 `/api/auth/me` 返回绑定学生信息**

```python
def _to_user_response(user: User, db: Session) -> UserResponse:
    student = db.query(Student).filter(Student.id == user.student_id).first() if user.student_id else None
    return UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        school_id=user.school_id,
        created_at=user.created_at,
        student_id=user.student_id,
        student_name=student.name if student else None,
        student_no=student.student_no if student else None,
    )
```

- [ ] **Step 6: 重新运行测试，确认通过**

Run: `python -m unittest tests.test_student_account_binding -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/accounts.py backend/app/routers/auth.py backend/app/routers/scores.py backend/tests/test_student_account_binding.py
git commit -m "fix: lock student scores to explicit binding"
```

### Task 3: 完成账号管理页的学生绑定交互

**Files:**
- Modify: `frontend/src/api/account.js`
- Modify: `frontend/src/api/student.js`
- Modify: `frontend/src/pages/AccountManage.jsx`
- Modify: `frontend/src/contexts/AuthContext.jsx`

- [ ] **Step 1: 先补齐接口层字段透传**

```javascript
export const updateAccount = (id, data) => request.put(`/api/accounts/${id}`, data)
// payload now includes student_id for student accounts
```

- [ ] **Step 2: 在账号管理页加“绑定学生”列和表单项**

```jsx
{
  title: '绑定学生',
  render: (_, record) => record.student_id
    ? `${record.student_name} (${record.student_no})`
    : '-',
}

{selectedRole === 'student' && (
  <Form.Item name="student_id" label="绑定学生">
    <Select
      showSearch
      optionFilterProp="label"
      options={studentOptions}
      allowClear
    />
  </Form.Item>
)}
```

- [ ] **Step 3: 表单联动角色切换，非学生角色自动清空 `student_id`**

```jsx
<Form.Item name="role" /* ... */>
  <Select onChange={(role) => {
    if (role !== 'student') form.setFieldValue('student_id', null)
  }} />
</Form.Item>
```

- [ ] **Step 4: 账号编辑提交时把 `student_id` 一并传给后端**

```javascript
const payload = {
  role: values.role,
  school_id: values.school_id,
  student_id: values.role === 'student' ? values.student_id ?? null : null,
}
```

- [ ] **Step 5: 前端静态验证**

Run: `npm run build`
Expected: build succeeds with no React/ESLint syntax errors from `AccountManage.jsx`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/account.js frontend/src/api/student.js frontend/src/pages/AccountManage.jsx frontend/src/contexts/AuthContext.jsx
git commit -m "feat: manage student bindings in account page"
```

### Task 4: 修复首页无节次时无法新增首个节次

**Files:**
- Modify: `frontend/src/api/schedule.js`
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: 在首页节次弹窗写失败场景保护，明确区分新增模式与编辑模式**

```javascript
const isCreatingFirstPeriod = periods.length === 0 && !editingPeriod
```

- [ ] **Step 2: 接通“新增首个节次”提交路径**

```javascript
if (isCreatingFirstPeriod) {
  await createSchedulePeriod({
    name: values.name,
    start_time: values.start_time.format('HH:mm'),
    end_time: values.end_time.format('HH:mm'),
    sort_order: values.sort_order,
  })
} else {
  await updatePeriodWithAdjustment(editingPeriod.id, values, timeDiff, adjustOthers)
}
```

- [ ] **Step 3: 放开空状态下的表单可编辑性**

```jsx
<Form.Item name="name" label="节次名称" rules={[{ required: true, message: '请输入节次名称' }]}>
  <Input disabled={!isCreatingFirstPeriod && periods.length > 0} />
</Form.Item>

{isCreatingFirstPeriod && (
  <Form.Item name="sort_order" label="排序" initialValue={1} rules={[{ required: true, message: '请输入排序号' }]}>
    <InputNumber min={1} style={{ width: '100%' }} />
  </Form.Item>
)}
```

- [ ] **Step 4: 新增成功后刷新并自动选中新节次**

```javascript
await loadData()
const periodsRes = await getSchedulePeriods()
const created = periodsRes.data[0]
setEditingPeriod(created ?? null)
```

- [ ] **Step 5: 前端静态验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/schedule.js frontend/src/pages/Home.jsx
git commit -m "fix: allow creating first schedule period from home"
```

### Task 5: 最终回归验证

**Files:**
- Test: `backend/tests/test_student_account_binding.py`
- Test: `backend/tests/test_scores_import_grade.py`
- Test: `backend/tests/test_class_three_rates_one_score.py`
- Modify: none

- [ ] **Step 1: 跑后端回归测试**

Run: `python -m unittest tests.test_student_account_binding tests.test_scores_import_grade tests.test_class_three_rates_one_score -v`
Expected: PASS

- [ ] **Step 2: 跑前端构建验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 手工验证关键路径**

```text
1. 用管理员账号进入账号管理，创建或编辑 student 账号并绑定学生档案。
2. 用该 student 账号登录，进入成绩管理，确认不再出现“学生角色需指定 student_id”。
3. 用 school_admin 账号进入首页，在没有节次数据的环境中点击“节次管理”，确认可直接新增首个节次。
4. 在已有节次数据时再次打开首页节次弹窗，确认编辑和顺延后续节次的旧逻辑仍可用。
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: bind student accounts and create first period from home"
```

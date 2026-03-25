# 自动排课引擎（异步任务版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有系统中交付“school_admin 可发起异步自动排课并轮询结果”的最小可用闭环，生成班级课表并支持班级/教师课表查询。

**Architecture:** 后端新增班级课表中心模型、课时计划与授课安排模型，以及 `schedule_tasks` 任务状态表；排课引擎采用“约束链 + 回溯分配”并在 FastAPI `BackgroundTasks` 内执行。前端新增排课管理页，提供配置、触发、轮询与结果展示。写入策略为“整年级覆盖 + 单事务原子提交”。

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, unittest, React, Ant Design, Axios

---

## File Structure Map

- `backend/alembic/versions/<revision>_add_phase1_schedule_tables.py`: 新增 `teacher_class_subjects` / `lesson_plans` / `class_timetables` / `schedule_tasks`。
- `backend/app/models/teacher_class_subject.py`: 班级-科目-教师任教关系。
- `backend/app/models/lesson_plan.py`: 年级课时计划与约束。
- `backend/app/models/class_timetable.py`: 班级课表中心模型（带班级/教师时段唯一约束）。
- `backend/app/models/schedule_task.py`: 异步排课任务状态。
- `backend/app/models/__init__.py`: 注册新模型。
- `backend/app/schemas/scheduling.py`: 新增请求/响应 schema（课时计划、授课安排、任务状态、课表视图）。
- `backend/app/services/scheduling/constraints.py`: 约束接口与内置约束实现。
- `backend/app/services/scheduling/engine.py`: 回溯引擎与诊断输出。
- `backend/app/routers/scheduling.py`: `/api/schedule/*` 相关接口与后台任务触发。
- `backend/app/routers/timetable.py`: `/api/timetable/class/{id}` 与 `/api/timetable/teacher/{id}`。
- `backend/app/main.py`: 注册新 router。
- `backend/tests/test_schedule_engine_constraints.py`: 约束与引擎单测。
- `backend/tests/test_scheduling_api.py`: 课时计划/授课安排/任务 API 测试。
- `backend/tests/test_timetable_api.py`: 班级/教师课表查询测试。
- `frontend/src/api/scheduling.js`: 新增排课相关 API 封装。
- `frontend/src/pages/ScheduleManage.jsx`: 排课管理页面（school_admin）。
- `frontend/src/App.jsx`: 注册新路由。
- `frontend/src/components/MainLayout.jsx`: 新增菜单项。

Execution discipline:
- Follow `superpowers:test-driven-development` per task.
- Before done-claim, run `superpowers:verification-before-completion` checklist.

### Task 1: 建立排课核心数据结构（迁移 + 模型）

**Files:**
- Create: `backend/alembic/versions/<revision>_add_phase1_schedule_tables.py`
- Create: `backend/app/models/teacher_class_subject.py`
- Create: `backend/app/models/lesson_plan.py`
- Create: `backend/app/models/class_timetable.py`
- Create: `backend/app/models/schedule_task.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_scheduling_api.py`

- [ ] **Step 1: 写失败测试，先锁定新表存在与关键唯一约束**

```python
import unittest

from sqlalchemy import inspect

from app.database import engine


class SchedulingSchemaTests(unittest.TestCase):
    def test_phase1_schedule_tables_exist(self):
        inspector = inspect(engine)
        names = set(inspector.get_table_names())
        self.assertIn("teacher_class_subjects", names)
        self.assertIn("lesson_plans", names)
        self.assertIn("class_timetables", names)
        self.assertIn("schedule_tasks", names)
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `python -m unittest tests.test_scheduling_api.SchedulingSchemaTests.test_phase1_schedule_tables_exist -v`
Expected: FAIL with missing schedule tables

- [ ] **Step 3: 实现新模型与唯一约束（最小实现）**

```python
class ClassTimetable(Base):
    __tablename__ = "class_timetables"
    __table_args__ = (
        UniqueConstraint("class_id", "weekday", "period_id", name="uq_class_slot"),
        UniqueConstraint("teacher_id", "weekday", "period_id", name="uq_teacher_slot"),
    )
```

- [ ] **Step 4: 添加 Alembic 迁移并同步模型导出**

```python
def upgrade() -> None:
    op.create_table(
        "schedule_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )
```

- [ ] **Step 5: 再跑测试，确认通过**

Run: `python -m unittest tests.test_scheduling_api.SchedulingSchemaTests.test_phase1_schedule_tables_exist -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/<revision>_add_phase1_schedule_tables.py backend/app/models/teacher_class_subject.py backend/app/models/lesson_plan.py backend/app/models/class_timetable.py backend/app/models/schedule_task.py backend/app/models/__init__.py backend/tests/test_scheduling_api.py
git commit -m "feat: add phase1 scheduling tables and models"
```

### Task 2: 实现约束接口与回溯排课引擎

**Files:**
- Create: `backend/app/services/scheduling/constraints.py`
- Create: `backend/app/services/scheduling/engine.py`
- Test: `backend/tests/test_schedule_engine_constraints.py`

- [ ] **Step 1: 写失败测试，固定约束行为（班级冲突/教师冲突/禁连堂/禁排）**

```python
import unittest

from app.services.scheduling.constraints import (
    ClassConflictConstraint,
    TeacherConflictConstraint,
    AvoidConsecutiveConstraint,
    ForbiddenPeriodConstraint,
)


class ConstraintTests(unittest.TestCase):
    def test_teacher_conflict_constraint_rejects_same_slot(self):
        state = {"teacher_busy": {(7, 1, 2)}}
        assignment = {"teacher_id": 7, "weekday": 1, "period_id": 2}
        ok, _ = TeacherConflictConstraint().check(state, assignment)
        self.assertFalse(ok)
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `python -m unittest tests.test_schedule_engine_constraints.ConstraintTests.test_teacher_conflict_constraint_rejects_same_slot -v`
Expected: FAIL with `ModuleNotFoundError` or missing classes

- [ ] **Step 3: 实现约束接口和内置约束类**

```python
class Constraint(Protocol):
    def check(self, state: dict, assignment: dict) -> tuple[bool, str | None]:
        ...
```

- [ ] **Step 4: 写失败测试，固定“有解可排、无解给诊断”行为**

```python
from app.services.scheduling.engine import ScheduleEngine


def test_engine_returns_failure_diagnostics_for_unsat_case(self):
    engine = ScheduleEngine()
    result = engine.solve(tasks=[...], slots=[...], constraints=[...])
    assert result.success is False
    assert "冲突" in result.message
```

- [ ] **Step 5: 实现最小回溯引擎与诊断输出**

```python
class ScheduleEngine:
    def solve(self, tasks, slots, constraints):
        # sort by priority then remaining candidate count
        # dfs backtracking with constraint chain
        return EngineResult(success=True, assignments=[...], message="ok")
```

- [ ] **Step 6: 运行完整引擎测试并通过**

Run: `python -m unittest tests.test_schedule_engine_constraints -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/scheduling/constraints.py backend/app/services/scheduling/engine.py backend/tests/test_schedule_engine_constraints.py
git commit -m "feat: add constraint-based schedule engine"
```

### Task 3: 交付 `/api/schedule/*` 配置与异步任务接口

**Files:**
- Create: `backend/app/schemas/scheduling.py`
- Create: `backend/app/routers/scheduling.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_scheduling_api.py`

- [ ] **Step 1: 写失败测试，固定 lesson-plan 与 teaching-arrangement 的批量保存契约**

```python
class SchedulingApiTests(unittest.TestCase):
    def test_save_lesson_plan_returns_saved_items(self):
        resp = self.client.post("/api/schedule/lesson-plan", json={"grade": "高一", "items": [...]})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 1)
```

- [ ] **Step 2: 运行单测确认失败**

Run: `python -m unittest tests.test_scheduling_api.SchedulingApiTests.test_save_lesson_plan_returns_saved_items -v`
Expected: FAIL with 404 route not found

- [ ] **Step 3: 实现配置接口与 schema**

```python
@router.post("/lesson-plan", response_model=LessonPlanBatchResponse)
def save_lesson_plan(req: LessonPlanBatchSaveRequest, ...):
    # upsert by (school_id, grade, subject_id)
    return LessonPlanBatchResponse(items=items)
```

- [ ] **Step 4: 写失败测试，固定异步任务创建与状态轮询**

```python
def test_create_auto_schedule_task_returns_pending(self):
    resp = self.client.post("/api/schedule/auto/高一")
    self.assertEqual(resp.status_code, 202)
    self.assertEqual(resp.json()["status"], "pending")
```

- [ ] **Step 5: 实现任务创建、后台执行、进度更新与失败处理**

```python
@router.post("/auto/{grade}", status_code=202)
def create_schedule_task(..., background_tasks: BackgroundTasks):
    task = ScheduleTask(status="pending", progress=0, ...)
    background_tasks.add_task(run_schedule_task, task.id)
    return {"task_id": task.id, "status": task.status}
```

- [ ] **Step 6: 加入权限与学校隔离测试（防越权）**

```python
def test_school_admin_cannot_read_other_school_task(self):
    resp = self.client_as_school_a.get(f"/api/schedule/tasks/{self.school_b_task_id}")
    self.assertEqual(resp.status_code, 404)

def test_teacher_cannot_create_schedule_task(self):
    resp = self.client_as_teacher.post("/api/schedule/auto/高一")
    self.assertEqual(resp.status_code, 403)
```

- [ ] **Step 7: 运行 API 测试并通过**

Run: `python -m unittest tests.test_scheduling_api -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/scheduling.py backend/app/routers/scheduling.py backend/app/main.py backend/tests/test_scheduling_api.py
git commit -m "feat: add scheduling config and async task APIs"
```

### Task 4: 实现课表查询接口（班级/教师）

**Files:**
- Create: `backend/app/routers/timetable.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas/scheduling.py`
- Test: `backend/tests/test_timetable_api.py`

- [ ] **Step 1: 写失败测试，固定班级课表与教师课表查询格式**

```python
class TimetableApiTests(unittest.TestCase):
    def test_get_class_timetable_returns_week_grid(self):
        resp = self.client.get(f"/api/timetable/class/{self.class_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("items", resp.json())
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest tests.test_timetable_api.TimetableApiTests.test_get_class_timetable_returns_week_grid -v`
Expected: FAIL with 404 route not found

- [ ] **Step 3: 实现查询接口，教师课表由班级课表聚合**

```python
@router.get("/teacher/{teacher_id}", response_model=TeacherTimetableResponse)
def get_teacher_timetable(...):
    rows = db.query(ClassTimetable).filter(ClassTimetable.teacher_id == teacher_id).all()
    return TeacherTimetableResponse(items=[...])
```

- [ ] **Step 4: 加入跨校越权读取测试**

```python
def test_school_admin_cannot_read_other_school_class_timetable(self):
    resp = self.client_as_school_a.get(f"/api/timetable/class/{self.school_b_class_id}")
    self.assertEqual(resp.status_code, 404)
```

- [ ] **Step 5: 运行测试并通过**

Run: `python -m unittest tests.test_timetable_api -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/timetable.py backend/app/schemas/scheduling.py backend/app/main.py backend/tests/test_timetable_api.py
git commit -m "feat: add class and teacher timetable query APIs"
```

### Task 5: 确保任务写入策略“整年级覆盖 + 原子事务”

**Files:**
- Modify: `backend/app/routers/scheduling.py`
- Test: `backend/tests/test_scheduling_api.py`

- [ ] **Step 1: 写失败测试，固定重跑覆盖策略**

```python
def test_successful_rerun_overwrites_grade_timetable_atomically(self):
    first_task = self.create_task_and_wait()
    second_task = self.create_task_and_wait(changed_plan=True)
    rows = self.query_grade_timetable_rows()
    self.assertEqual(rows, self.expected_second_run_rows)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest tests.test_scheduling_api.SchedulingApiTests.test_successful_rerun_overwrites_grade_timetable_atomically -v`
Expected: FAIL because old rows remain or partial rows appear

- [ ] **Step 3: 在后台执行中加入单事务“先删后写”与异常回滚**

```python
with db.begin():
    db.query(ClassTimetable).filter(ClassTimetable.class_id.in_(grade_class_ids)).delete(synchronize_session=False)
    db.bulk_save_objects(new_rows)
```

- [ ] **Step 4: 运行目标测试并通过**

Run: `python -m unittest tests.test_scheduling_api.SchedulingApiTests.test_successful_rerun_overwrites_grade_timetable_atomically -v`
Expected: PASS

- [ ] **Step 5: 增加失败任务不污染旧课表测试**

```python
def test_failed_task_keeps_previous_timetable_unchanged(self):
    self.create_task_and_wait(valid_input=True)
    before = self.query_grade_timetable_rows()
    self.create_task_and_wait(valid_input=False)  # expect failed
    after = self.query_grade_timetable_rows()
    self.assertEqual(before, after)
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/scheduling.py backend/tests/test_scheduling_api.py
git commit -m "fix: enforce atomic overwrite policy for schedule reruns"
```

### Task 6: 前端交付排课管理最小可用页面

**Files:**
- Create: `frontend/src/api/scheduling.js`
- Create: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/MainLayout.jsx`

- [ ] **Step 1: 写前端失败预期（先不改实现）并记录最小交互验收**

```text
验收脚本（手动）:
1) school_admin 可看到“排课管理”菜单。
2) 可保存课时计划与授课安排。
3) 点击“开始排课”后显示 task_id 与状态。
4) 页面每 2 秒轮询一次任务状态并展示 progress/message。
5) success/failed 状态能终止轮询。
```

- [ ] **Step 2: 新增 API 封装并在页面实现配置/触发/轮询流程**

```javascript
export const createAutoScheduleTask = (grade) => request.post(`/api/schedule/auto/${encodeURIComponent(grade)}`)
export const getScheduleTask = (taskId) => request.get(`/api/schedule/tasks/${taskId}`)
```

- [ ] **Step 3: 注册路由与菜单（仅 school_admin 可见）**

```jsx
<Route path="/schedule-manage" element={<ScheduleManage />} />
```

- [ ] **Step 4: 前端构建验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/scheduling.js frontend/src/pages/ScheduleManage.jsx frontend/src/App.jsx frontend/src/components/MainLayout.jsx
git commit -m "feat: add schedule management page with task polling"
```

### Task 7: 全量验证与交付检查

**Files:**
- Modify: none
- Test: `backend/tests/test_schedule_engine_constraints.py`
- Test: `backend/tests/test_scheduling_api.py`
- Test: `backend/tests/test_timetable_api.py`

- [ ] **Step 1: 跑后端排课相关测试集**

Run: `python -m unittest tests.test_schedule_engine_constraints tests.test_scheduling_api tests.test_timetable_api -v`
Expected: PASS

- [ ] **Step 2: 跑前端构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 手工联调验收**

```text
1. school_admin 进入排课管理，先保存“高一”课时计划与授课安排。
2. 点击“开始排课”，获得 task_id。
3. 观察状态从 pending/running 到 success；若 failed，展示冲突诊断。
4. 调用班级课表与教师课表接口，确认数据一致。
5. 修改配置后再次触发排课，确认“整年级覆盖”生效（旧结果被替换）。
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify phase1 schedule engine end-to-end"
```

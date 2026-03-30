# CP-SAT Scheduling Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 AI/回溯混合排课链路重构为“结构化规则 + CP-SAT 求解 + 草案预览发布 + 规则驱动前端工作台”的正式排课系统。

**Architecture:** 后端保留现有排课域路由前缀和正式课表表 `class_timetables`，新增规则覆写、教师约束、锁课、草案头/明细等持久层，并将排课流程拆成配置加载、求解前校验、规则编译、CP-SAT 求解、草案持久化、正式发布六层服务。前端重写 `ScheduleManage.jsx` 为规则驱动控制台，采用“总控条 + 规则面板 + 草案总览 + 钻取详情 + 发布前校验”的工作台结构，移除 AI 聊天式排课交互。

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, OR-Tools CP-SAT, unittest, React 19, Ant Design 6, Tailwind 4, Axios, Vite 8

---

## File Structure Map

- `backend/alembic/versions/b4c1d9e7f2a0_add_schedule_drafts_and_constraints.py`: 新增草案、锁课、教师约束、班级覆写等表。
- `backend/app/models/lesson_plan.py`: 保留年级基础规则模型，仅承载结构化 JSON 规则。
- `backend/app/models/schedule_task.py`: 保留异步任务表，收敛到“求解/发布任务”语义。
- `backend/app/models/lesson_plan_override.py`: 班级级别规则覆写。
- `backend/app/models/teacher_time_constraint.py`: 教师禁排、每日最大课时、偏好时段。
- `backend/app/models/timetable_lock.py`: 锁课记录。
- `backend/app/models/schedule_draft.py`: 草案头信息。
- `backend/app/models/schedule_draft_item.py`: 草案课表明细。
- `backend/app/models/__init__.py`: 注册新增模型。
- `backend/app/schemas/scheduling.py`: 重写为结构化规则、草案、任务、发布前校验相关 schema。
- `backend/app/services/scheduling/config_loader.py`: 汇总规则、授课安排、节次、锁课、教师约束。
- `backend/app/services/scheduling/validators.py`: 求解前校验和结构化诊断。
- `backend/app/services/scheduling/compiler.py`: 将业务规则编译为 lesson/slot/constraint 中间模型。
- `backend/app/services/scheduling/scoring.py`: 软约束权重与目标函数构造。
- `backend/app/services/scheduling/cp_sat_solver.py`: OR-Tools CP-SAT 求解器。
- `backend/app/services/scheduling/draft_service.py`: 草案保存、读取、摘要封装。
- `backend/app/services/scheduling/publish_service.py`: 草案发布到正式课表。
- `backend/app/services/scheduling/__init__.py`: 导出新服务入口。
- `backend/app/services/scheduling/engine.py`: 删除或改为兼容包装器，最终不再承载正式求解。
- `backend/app/services/scheduling/constraints.py`: 删除或仅保留共享 slot/规则帮助函数。
- `backend/app/services/scheduling/ai_scheduler.py`: 删除。
- `backend/app/routers/scheduling.py`: 改造为规则配置、草案求解、草案查看、草案发布接口。
- `backend/app/routers/timetable.py`: 保持正式课表查询语义，必要时补充草案查询 helper。
- `backend/app/main.py`: 保持路由注册，必要时补充新依赖初始化。
- `backend/tests/test_scheduling_models_and_migrations.py`: 新数据结构和迁移测试。
- `backend/tests/test_scheduling_config_api.py`: 规则配置与权限测试。
- `backend/tests/test_scheduling_cp_sat_solver.py`: CP-SAT 求解器与诊断测试。
- `backend/tests/test_scheduling_draft_api.py`: 草案求解、查询、发布接口测试。
- `frontend/src/api/scheduling.js`: 重写为规则/草案/发布 API 层。
- `frontend/src/pages/ScheduleManage.jsx`: 重写为规则驱动排课控制台。
- `frontend/src/components/MainLayout.jsx`: 保持菜单入口，如命名调整则同步。
- `frontend/src/App.jsx`: 保持路由指向新页面。
- `frontend/src/index.css`: 加入控制台视觉变量和排课页样式。
- `docs/superpowers/specs/2026-03-30-cp-sat-scheduling-redesign-design.md`: 已确认 spec，实施时持续对照。

Execution discipline:
- Follow `superpowers:test-driven-development` per task.
- Before claiming implementation complete, run `superpowers:verification-before-completion`.

### Task 1: 建立 CP-SAT 排课持久层基础

**Files:**
- Create: `backend/alembic/versions/b4c1d9e7f2a0_add_schedule_drafts_and_constraints.py`
- Create: `backend/app/models/lesson_plan_override.py`
- Create: `backend/app/models/teacher_time_constraint.py`
- Create: `backend/app/models/timetable_lock.py`
- Create: `backend/app/models/schedule_draft.py`
- Create: `backend/app/models/schedule_draft_item.py`
- Modify: `backend/app/models/lesson_plan.py`
- Modify: `backend/app/models/schedule_task.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_scheduling_models_and_migrations.py`

- [ ] **Step 1: 写失败测试，先固定新表和关键唯一约束**

```python
import unittest

from sqlalchemy import inspect

from app.database import engine


class SchedulingPersistenceTests(unittest.TestCase):
    def test_cp_sat_schedule_tables_exist(self):
        inspector = inspect(engine)
        names = set(inspector.get_table_names())
        self.assertIn("lesson_plan_overrides", names)
        self.assertIn("teacher_time_constraints", names)
        self.assertIn("timetable_locks", names)
        self.assertIn("schedule_drafts", names)
        self.assertIn("schedule_draft_items", names)
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_models_and_migrations.SchedulingPersistenceTests.test_cp_sat_schedule_tables_exist -v`
Expected: FAIL with missing schedule tables

- [ ] **Step 3: 实现最小模型定义和关键唯一约束**

```python
class TimetableLock(Base):
    __tablename__ = "timetable_locks"
    __table_args__ = (
        UniqueConstraint("class_id", "weekday", "period_id", name="uq_timetable_lock_slot"),
    )
```

- [ ] **Step 4: 编写 Alembic 迁移并更新模型导出**

```python
def upgrade() -> None:
    op.create_table(
        "schedule_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
    )
```

- [ ] **Step 5: 运行测试，确认表结构测试通过**

Run from `backend/`: `python -m unittest tests.test_scheduling_models_and_migrations -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/b4c1d9e7f2a0_add_schedule_drafts_and_constraints.py backend/app/models/lesson_plan_override.py backend/app/models/teacher_time_constraint.py backend/app/models/timetable_lock.py backend/app/models/schedule_draft.py backend/app/models/schedule_draft_item.py backend/app/models/lesson_plan.py backend/app/models/schedule_task.py backend/app/models/__init__.py backend/tests/test_scheduling_models_and_migrations.py
git commit -m "feat: add CP-SAT scheduling persistence models"
```

### Task 2: 交付结构化规则配置 API

**Files:**
- Modify: `backend/app/schemas/scheduling.py`
- Modify: `backend/app/routers/scheduling.py`
- Test: `backend/tests/test_scheduling_config_api.py`

- [ ] **Step 1: 写失败测试，固定 lesson plan、override、teacher constraints、locks 的 API 契约**

```python
class SchedulingConfigApiTests(unittest.TestCase):
    def test_save_teacher_constraints_returns_saved_rows(self):
        response = self.client.post(
            "/api/schedule/teacher-constraints",
            json={"grade": "八年级", "items": [{"teacher_id": 7, "daily_max_hours": 4, "forbidden_periods": [[1, 1]]}]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["teacher_id"], 7)
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_config_api.SchedulingConfigApiTests.test_save_teacher_constraints_returns_saved_rows -v`
Expected: FAIL with 404 or response schema mismatch

- [ ] **Step 3: 定义结构化 schema，删除 AI 请求/响应 schema**

```python
class TeacherConstraintItem(BaseModel):
    teacher_id: int
    daily_max_hours: int = Field(ge=0)
    forbidden_periods: list[list[int]] = Field(default_factory=list)
    preferred_periods: list[list[int]] = Field(default_factory=list)
```

- [ ] **Step 4: 实现配置接口的 upsert 行为和学校隔离**

```python
@router.post("/teacher-constraints", response_model=TeacherConstraintBatchResponse)
def save_teacher_constraints(req: TeacherConstraintBatchSaveRequest, ...):
    # upsert by (school_id, grade, teacher_id)
    return TeacherConstraintBatchResponse(grade=req.grade, items=items)
```

- [ ] **Step 5: 加入权限与跨校访问失败测试**

```python
def test_teacher_cannot_save_locks(self):
    response = self.teacher_client.post("/api/schedule/locks", json={"grade": "八年级", "items": []})
    self.assertEqual(response.status_code, 403)
```

- [ ] **Step 6: 运行配置 API 测试，确认通过**

Run from `backend/`: `python -m unittest tests.test_scheduling_config_api -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/scheduling.py backend/app/routers/scheduling.py backend/tests/test_scheduling_config_api.py
git commit -m "feat: add structured scheduling config APIs"
```

### Task 3: 实现配置加载、求解前校验与规则编译

**Files:**
- Create: `backend/app/services/scheduling/config_loader.py`
- Create: `backend/app/services/scheduling/validators.py`
- Create: `backend/app/services/scheduling/compiler.py`
- Modify: `backend/app/services/scheduling/__init__.py`
- Test: `backend/tests/test_scheduling_cp_sat_solver.py`

- [ ] **Step 1: 写失败测试，固定锁课、教师约束、班级覆写会进入编译结果**

```python
def test_compile_problem_includes_locked_slot_and_teacher_limits(self):
    compiled = compile_problem(raw_config)
    self.assertEqual(compiled.locked_assignments[0].weekday, 2)
    self.assertEqual(compiled.teacher_daily_limits[7], 4)
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_cp_sat_solver.CompilerTests.test_compile_problem_includes_locked_slot_and_teacher_limits -v`
Expected: FAIL with missing compiler module or missing fields

- [ ] **Step 3: 实现配置加载器，统一读取年级规则与授课安排**

```python
@dataclass
class SchedulingRawConfig:
    grade: str
    classes: list[Class]
    periods: list[SchedulePeriod]
    arrangements: list[TeacherClassSubject]
    lesson_plans: list[LessonPlan]
```

- [ ] **Step 4: 实现求解前校验器，先拦截明显无解**

```python
def validate_capacity(raw_config: SchedulingRawConfig) -> list[Diagnostic]:
    if total_weekly_hours > total_slot_capacity:
        return [Diagnostic(code="grade_capacity_exceeded", ...)]
    return []
```

- [ ] **Step 5: 实现规则编译器，输出 CP-SAT 中间模型**

```python
@dataclass
class CompiledLesson:
    lesson_id: str
    class_id: int
    subject_id: int
    teacher_id: int
    candidate_slots: list[SlotKey]
```

- [ ] **Step 6: 运行编译与校验测试，确认通过**

Run from `backend/`: `python -m unittest tests.test_scheduling_cp_sat_solver.CompilerTests -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/scheduling/config_loader.py backend/app/services/scheduling/validators.py backend/app/services/scheduling/compiler.py backend/app/services/scheduling/__init__.py backend/tests/test_scheduling_cp_sat_solver.py
git commit -m "feat: add scheduling compiler and validation services"
```

### Task 4: 实现 OR-Tools CP-SAT 求解器与结构化诊断

**Files:**
- Create: `backend/app/services/scheduling/scoring.py`
- Create: `backend/app/services/scheduling/cp_sat_solver.py`
- Modify: `backend/app/services/scheduling/__init__.py`
- Test: `backend/tests/test_scheduling_cp_sat_solver.py`

- [ ] **Step 1: 写失败测试，固定“硬约束满足 + 软约束评分 + 锁课保留”行为**

```python
def test_solver_keeps_locked_lessons_and_returns_score(self):
    result = solve_schedule(compiled_problem)
    self.assertTrue(result.success)
    self.assertIn(("8-1:math:1", (2, 3)), result.assignment_map.items())
    self.assertGreaterEqual(result.score, 0)
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_cp_sat_solver.CpSatSolverTests.test_solver_keeps_locked_lessons_and_returns_score -v`
Expected: FAIL with missing solver module or missing fields

- [ ] **Step 3: 实现最小 CP-SAT 变量和硬约束**

```python
for lesson in problem.lessons:
    vars_for_lesson = [x[(lesson.lesson_id, slot.key)] for slot in lesson.candidate_slots]
    model.AddExactlyOne(vars_for_lesson)
```

- [ ] **Step 4: 实现软约束 penalty/reward 和得分摘要**

```python
penalty = model.NewIntVar(0, 1000, "penalty_core_subject_afternoon")
objective_terms.append(problem.weights.core_subject_morning * penalty)
```

- [ ] **Step 5: 实现无解结果的结构化诊断输出**

```python
return SolverResult(
    success=False,
    diagnostics=[Diagnostic(code="teacher_capacity_shortage", entity_id=teacher_id, ...)],
)
```

- [ ] **Step 6: 运行完整求解器测试，确认通过**

Run from `backend/`: `python -m unittest tests.test_scheduling_cp_sat_solver -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/scheduling/scoring.py backend/app/services/scheduling/cp_sat_solver.py backend/app/services/scheduling/__init__.py backend/tests/test_scheduling_cp_sat_solver.py
git commit -m "feat: add OR-Tools CP-SAT scheduling solver"
```

### Task 5: 交付草案求解、草案查询和正式发布 API

**Files:**
- Create: `backend/app/services/scheduling/draft_service.py`
- Create: `backend/app/services/scheduling/publish_service.py`
- Modify: `backend/app/schemas/scheduling.py`
- Modify: `backend/app/routers/scheduling.py`
- Modify: `backend/app/routers/timetable.py`
- Test: `backend/tests/test_scheduling_draft_api.py`

- [ ] **Step 1: 写失败测试，固定草案求解任务和草案读取契约**

```python
class SchedulingDraftApiTests(unittest.TestCase):
    def test_solve_draft_returns_pending_task(self):
        response = self.client.post("/api/schedule/drafts/八年级/solve")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "pending")
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_draft_api.SchedulingDraftApiTests.test_solve_draft_returns_pending_task -v`
Expected: FAIL with 404 route not found

- [ ] **Step 3: 实现后台任务，调用加载器/校验器/编译器/求解器并保存草案**

```python
@router.post("/drafts/{grade}/solve", response_model=ScheduleTaskCreateResponse, status_code=202)
def solve_schedule_draft(...):
    task = ScheduleTask(status="pending", progress=0, ...)
    background_tasks.add_task(run_draft_task, task.id)
    return ScheduleTaskCreateResponse(task_id=task.id, status=task.status)
```

- [ ] **Step 4: 写失败测试，固定“发布草案 -> 正式课表覆盖”行为**

```python
def test_publish_draft_replaces_grade_timetable_atomically(self):
    response = self.client.post(f"/api/schedule/drafts/{self.draft_id}/publish")
    self.assertEqual(response.status_code, 200)
    self.assertEqual(self.query_live_timetable_count("八年级"), 35)
```

- [ ] **Step 5: 实现发布服务和正式课表单事务覆盖**

```python
def publish_draft(db: Session, draft_id: int) -> PublishResult:
    db.query(ClassTimetable).filter(ClassTimetable.class_id.in_(grade_class_ids)).delete(synchronize_session=False)
    db.add_all(live_rows)
    db.commit()
```

- [ ] **Step 6: 运行草案 API 测试，确认通过**

Run from `backend/`: `python -m unittest tests.test_scheduling_draft_api -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/scheduling/draft_service.py backend/app/services/scheduling/publish_service.py backend/app/schemas/scheduling.py backend/app/routers/scheduling.py backend/app/routers/timetable.py backend/tests/test_scheduling_draft_api.py
git commit -m "feat: add draft solve and publish APIs"
```

### Task 6: 重写前端 API 层和排课控制台骨架

**Files:**
- Modify: `frontend/src/api/scheduling.js`
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend` build smoke check via `npm.cmd run build`

- [ ] **Step 1: 先写页面状态映射清单，删掉 AI API 调用并固定新接口命名**

```javascript
export const solveScheduleDraft = (grade) => request.post(`/api/schedule/drafts/${encodeURIComponent(grade)}/solve`)
export const publishScheduleDraft = (draftId) => request.post(`/api/schedule/drafts/${draftId}/publish`)
```

- [ ] **Step 2: 运行前端构建，确认当前实现还未兼容新接口**

Run from `frontend/`: `npm.cmd run build`
Expected: PASS or FAIL only if unrelated existing issues exist; note current baseline before edits

- [ ] **Step 3: 重写 `ScheduleManage.jsx` 为规则驱动控制台骨架**

```jsx
<SchedulerHeader />
<SchedulerRuleSidebar />
<SchedulerDraftOverview />
<SchedulerDrilldownPanel />
<SchedulerPublishGate />
```

- [ ] **Step 4: 接入规则配置、草案求解、草案查询、发布操作的受控状态**

```jsx
const [draftSummary, setDraftSummary] = useState(null)
const [publishChecks, setPublishChecks] = useState([])
const [selectedClassId, setSelectedClassId] = useState(null)
```

- [ ] **Step 5: 加入控制台视觉变量，匹配 spec 的浅底蓝系数据工作台方向**

```css
:root {
  --scheduler-primary: #1e40af;
  --scheduler-accent: #f59e0b;
  --scheduler-surface: #f8fafc;
}
```

- [ ] **Step 6: 重新构建前端，确认通过**

Run from `frontend/`: `npm.cmd run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/scheduling.js frontend/src/pages/ScheduleManage.jsx frontend/src/index.css
git commit -m "feat: add rule-driven scheduling console shell"
```

### Task 7: 完成前端钻取详情、发布前校验和课表预览联动

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/api/scheduling.js`
- Modify: `frontend/src/components/MainLayout.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend` build smoke check via `npm.cmd run build`

- [ ] **Step 1: 写出要展示的草案摘要字段映射，固定前端读取契约**

```javascript
const summaryCards = [
  { key: 'hard_pass_rate', label: '硬约束满足率' },
  { key: 'score', label: '软约束得分' },
  { key: 'locked_hits', label: '锁课命中' },
  { key: 'risk_count', label: '待处理风险' },
]
```

- [ ] **Step 2: 接入班级/教师钻取与周课表矩阵**

```jsx
<Table dataSource={draftItemsByClass[selectedClassId] || []} columns={previewColumns} />
```

- [ ] **Step 3: 接入发布前校验面板和发布操作反馈**

```jsx
{publishChecks.map((item) => (
  <Alert key={item.code} type={item.blocking ? 'error' : 'warning'} message={item.message} />
))}
```

- [ ] **Step 4: 如菜单标题需要微调，更新导航和路由显示文案**

```jsx
{ key: '/schedule-manage', icon: <TableOutlined />, label: '排课工作台', roles: ['school_admin'] }
```

- [ ] **Step 5: 重新构建前端并做人工冒烟检查**

Run from `frontend/`: `npm.cmd run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx frontend/src/api/scheduling.js frontend/src/components/MainLayout.jsx frontend/src/App.jsx
git commit -m "feat: add scheduling draft drill-down and publish UI"
```

### Task 8: 删除 AI 排课链路并完成回归验证

**Files:**
- Delete: `backend/app/services/scheduling/ai_scheduler.py`
- Modify: `backend/app/routers/scheduling.py`
- Modify: `backend/app/schemas/scheduling.py`
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/api/scheduling.js`
- Test: `backend/tests/test_scheduling_models_and_migrations.py`
- Test: `backend/tests/test_scheduling_config_api.py`
- Test: `backend/tests/test_scheduling_cp_sat_solver.py`
- Test: `backend/tests/test_scheduling_draft_api.py`

- [ ] **Step 1: 写失败测试，固定旧 AI 接口不再暴露**

```python
def test_ai_schedule_routes_are_removed(self):
    response = self.client.post("/api/schedule/ai/auto/八年级", json={})
    self.assertEqual(response.status_code, 404)
```

- [ ] **Step 2: 运行测试，确认失败**

Run from `backend/`: `python -m unittest tests.test_scheduling_draft_api.SchedulingDraftApiTests.test_ai_schedule_routes_are_removed -v`
Expected: FAIL because old route still exists

- [ ] **Step 3: 删除 `ai_scheduler.py` 并清理 router/schema/frontend 中所有 AI 排课入口**

```python
# remove imports:
# from app.services.scheduling.ai_scheduler import ...
```

- [ ] **Step 4: 运行完整后端测试套件**

Run from `backend/`: `python -m unittest tests.test_scheduling_models_and_migrations tests.test_scheduling_config_api tests.test_scheduling_cp_sat_solver tests.test_scheduling_draft_api -v`
Expected: PASS

- [ ] **Step 5: 运行后端语法检查**

Run from `backend/`: `python -m py_compile app/routers/scheduling.py app/schemas/scheduling.py app/services/scheduling/config_loader.py app/services/scheduling/validators.py app/services/scheduling/compiler.py app/services/scheduling/scoring.py app/services/scheduling/cp_sat_solver.py app/services/scheduling/draft_service.py app/services/scheduling/publish_service.py`
Expected: PASS with no output

- [ ] **Step 6: 再跑前端构建回归**

Run from `frontend/`: `npm.cmd run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/scheduling.py backend/app/schemas/scheduling.py frontend/src/pages/ScheduleManage.jsx frontend/src/api/scheduling.js
git rm backend/app/services/scheduling/ai_scheduler.py
git commit -m "refactor: remove AI scheduling flow in favor of CP-SAT drafts"
```

## Final Verification Checklist

- [ ] `backend/` 下新增 4 组测试文件全部可运行并通过。
- [ ] `frontend/` 构建通过且排课页无 AI 对话入口。
- [ ] 求解流程是“生成草案 -> 查看草案 -> 发布草案”，不是“直接写正式课表”。
- [ ] 锁课记录会进入求解输入并在草案中标记命中状态。
- [ ] 正式课表查询接口只读取发布后的 `class_timetables`。
- [ ] `docs/superpowers/specs/2026-03-30-cp-sat-scheduling-redesign-design.md` 中已确认的范围没有遗漏。

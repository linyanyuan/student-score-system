# 自动排课引擎（异步任务版）设计说明

## 1. 背景与目标

当前系统已有教师课表编辑能力，但缺少“以班级课表为核心”的统一排课机制。根据《项目需求1.1》《技术文档1.1》，本阶段优先交付自动排课引擎最小可用版，采用异步任务模式（任务 ID + 轮询查询），并具备可扩展约束接口。

本阶段目标：
- 提供管理员可用的自动排课闭环：配置 -> 发起排课 -> 查看进度/结果 -> 查询课表。
- 约束覆盖：班级冲突、教师冲突、周课时满足、禁止连堂、禁止时间段。
- 设计扩展点：后续可接入场地约束、合班课约束，不重写主引擎流程。

非目标（本阶段不做）：
- 教师调课申请/审批完整流程。
- 前端拖拽调课与复杂交互。
- 分布式任务队列（Celery/Redis）。

## 2. 现状与差异分析

现有系统关键点：
- 数据模型以 `teacher_schedules`（教师视角）为主。
- Home 页面允许教师直接编辑课表。
- 已具备班级、科目、教师-班级关系等基础数据。

与新需求差异：
- 需新增“班级课表中心模型”，教师课表由班级课表派生。
- 需新增课时计划、班级-科目-教师任教关系。
- 需引入异步排课任务与进度查询接口。

## 3. 总体方案

采用“单进程后台任务 + 数据库存储任务状态”的架构：
- API 接收排课请求后创建 `schedule_tasks` 记录并返回 `task_id`。
- 使用 FastAPI `BackgroundTasks` 在当前应用进程内执行排课。
- 排课过程中持续更新任务进度；完成后写入结果摘要或失败诊断。
- 前端轮询任务接口展示状态。

该方案兼容当前项目结构，开发成本低，适合阶段一快速落地。

## 4. 数据模型设计

### 4.1 新增表

1) `teacher_class_subjects`
- 用途：描述“某班某科由哪位教师任教”。
- 字段：`id`, `school_id`, `teacher_id`, `class_id`, `subject_id`, `created_at`
- 约束：唯一键 `(class_id, subject_id)`。

2) `lesson_plans`
- 用途：按学校+年级配置科目周课时与约束。
- 字段：`id`, `school_id`, `grade`, `subject_id`, `weekly_hours`, `priority`, `avoid_consecutive`, `forbidden_periods_json`, `created_at`, `updated_at`
- 说明：`forbidden_periods_json` 存储类似 `[[1,1],[5,6]]`（星期,节次）。
- 约束：唯一键 `(school_id, grade, subject_id)`。

3) `class_timetables`
- 用途：班级课表主数据源。
- 字段：`id`, `school_id`, `class_id`, `weekday`, `period_id`, `subject_id`, `teacher_id`, `created_at`, `updated_at`
- 约束：
  - 唯一键 `(class_id, weekday, period_id)` 保证班级同时间唯一。
  - 唯一键 `(teacher_id, weekday, period_id)` 保证教师同时间唯一。

4) `schedule_tasks`
- 用途：异步排课任务追踪。
- 字段：`id`, `school_id`, `grade`, `status`, `progress`, `message`, `result_json`, `error_json`, `created_by`, `started_at`, `finished_at`, `created_at`, `updated_at`
- 状态：`pending | running | success | failed`。

### 4.2 迁移策略

- 使用 Alembic 新增以上表与索引。
- 本阶段保留 `teacher_schedules` 表，避免破坏旧功能；新功能优先读写 `class_timetables`。

## 5. API 设计

### 5.1 课时计划
- `GET /api/schedule/lesson-plan/{grade}`
- `POST /api/schedule/lesson-plan`（批量保存）

### 5.2 授课安排
- `GET /api/schedule/teaching-arrangement/{grade}`
- `POST /api/schedule/teaching-arrangement`（批量保存）

### 5.3 自动排课（异步）
- `POST /api/schedule/auto/{grade}`
  - 动作：创建任务并启动后台排课。
  - 返回：`{ task_id, status }`
- `GET /api/schedule/tasks/{task_id}`
  - 动作：查询任务状态、进度、结果摘要、错误信息。

### 5.4 课表查询
- `GET /api/timetable/class/{class_id}`（班级周课表）
- `GET /api/timetable/teacher/{teacher_id}`（教师周课表，由班级课表聚合）

## 6. 排课引擎设计

### 6.1 输入
- 指定学校与年级下：班级列表、节次列表、课时计划、授课安排。

### 6.2 求解流程
1. 校验输入完整性（缺课时计划/授课安排直接失败）。
2. 生成待排任务列表：按班级+科目展开 `weekly_hours` 条任务。
3. 排序策略：优先级小者先排，再按候选时段数升序（MRV 思路）。
4. 回溯分配：尝试候选时段，逐条执行约束检查。
5. 成功则写入 `class_timetables`；失败则输出冲突诊断。

### 6.3 约束接口（可扩展）
- 抽象接口：`Constraint.check(state, assignment) -> (ok, reason)`。
- 内置约束实现：
  - `ClassConflictConstraint`
  - `TeacherConflictConstraint`
  - `AvoidConsecutiveConstraint`
  - `ForbiddenPeriodConstraint`
  - `WeeklyHoursConstraint`（用于结束态验证）
- 后续新增约束只需实现接口并注册到约束链。

### 6.4 诊断信息
失败时记录可操作建议，例如：
- 哪个班级/科目无法满足课时。
- 哪位教师冲突最频繁。
- 建议调整授课安排或禁排配置。

## 7. 权限与安全

- 仅 `school_admin` 可配置课时计划、授课安排并触发自动排课。
- 查询课表遵循学校数据隔离。
- 任务读取需校验学校归属，防止跨校访问。

## 8. 前端最小可用改造

新增排课管理页面（`school_admin`）：
- 年级选择。
- 课时计划配置（表格）。
- 授课安排配置（班级 × 科目）。
- “开始排课”按钮。
- 任务轮询区：显示状态、进度、消息、失败原因。
- 成功后提供课表查看入口。

本阶段不做拖拽调课、不做教师调课审批 UI。

## 9. 测试与验收

### 9.1 后端单元测试
- 约束测试：每个约束的通过/失败案例。
- 引擎测试：
  - 有解场景可生成完整课表。
  - 无解场景返回明确诊断。

### 9.2 API 测试
- 任务创建成功并返回 `task_id`。
- 轮询状态从 `pending/running` 进入 `success/failed`。
- 成功时 `class_timetables` 正确写入。

### 9.3 回归测试
- 现有成绩、学生、考试模块接口保持可用。

验收标准：
- 单年级（<=12班）可在可接受时间内完成排课（具体性能后续压测量化）。
- 失败任务必须给出可读且可操作的冲突提示。

## 10. 风险与后续演进

风险：
- 单进程后台任务在多实例部署下可控性弱。
- 复杂约束组合可能导致回溯耗时增大。

后续演进：
- 将任务执行迁移到 DB 队列 Worker 或 Redis 队列。
- 引入更强启发式策略与可中断重试机制。
- 第二阶段实现调课申请/审批流，与班级课表统一。

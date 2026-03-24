# 学生账号显式绑定与首页节次新增设计

## 目标
解决两个已确认的线上问题：
1. `school_admin` 在首页点击“节次管理”时，若当前没有节次数据，弹窗无法直接新增首个节次。
2. `student` 角色进入成绩管理时，请求 `/api/scores` 会因缺少 `student_id` 报 400；系统需要改为显式账号绑定，不再依赖用户名猜测学生身份。

## 问题拆解

### 1) 首页节次管理
- 当前后端已提供创建节次接口，前端也已有 `createSchedulePeriod` API。
- 现状问题在于 [Home.jsx](/D:/project/student-score-system/frontend/src/pages/Home.jsx) 的弹窗仅支持“编辑已有节次”。
- 当 `periods.length === 0` 时：
  - 表单标题仍停留在“节次管理”空状态。
  - `name` 输入框禁用。
  - 弹窗 footer 只有关闭按钮。
  - `handlePeriodSubmit` 会因 `editingPeriod` 为空直接拦截。

### 2) 学生成绩访问
- 当前 [scores.py](/D:/project/student-score-system/backend/app/routers/scores.py) 对学生角色仍要求外部传入 `student_id`。
- 系统没有稳定的 `user -> student` 显式关联字段。
- 现有部分代码曾用“`username == student_no`”猜测学生身份，但这与当前实际数据录入方式不一致，也无法处理重名、改名和历史脏数据。

## 方案选择

### 方案 A：继续用用户名猜测学生（不推荐）
- 兼容“用户名=姓名”或“用户名=学号”。
- 优点：改动最小。
- 风险：规则不稳定，容易误绑；后续账号改名会破坏行为。

### 方案 B：在 `users` 表上增加 `student_id` 外键（推荐）
- 学生账号由管理员在账号管理页显式绑定学生档案。
- 学生访问成绩时由后端自动使用 `current_user.student_id`。
- 优点：实现直接、数据关系清晰、改动范围可控。

### 方案 C：新建独立绑定表（不推荐）
- 可扩展性更高，但当前场景没有一对多需求。
- 会增加额外模型、迁移和维护成本。

结论：采用方案 B。

## 数据设计

### User 模型
- 在 `users` 表新增可空字段：
  - `student_id INTEGER NULL REFERENCES students(id)`
- 约束：
  - 一个学生档案最多绑定一个学生账号。
  - 非 `student` 角色账号不允许绑定 `student_id`。

### 返回结构补充
- 账号列表和 `/api/auth/me` 返回中增加：
  - `student_id`
  - `student_name`
  - `student_no`

用途：
- 管理员可在账号管理页直观看到绑定结果。
- 前端可根据 `student_id` 判断学生账号是否已完成绑定。

## 后端设计

### 1) 账号管理
修改 [accounts.py](/D:/project/student-score-system/backend/app/routers/accounts.py)：
- `CreateAccountRequest`、`UpdateAccountRequest` 支持 `student_id`
- 创建/更新账号时增加校验：
  - 只有 `student` 角色允许设置 `student_id`
  - `student_id` 必须存在
  - `student_id` 不能已被其他用户占用
  - 若后续把角色从 `student` 改成其他角色，应清空 `student_id`

### 2) 认证返回
修改 [auth.py](/D:/project/student-score-system/backend/app/routers/auth.py) 与认证 schema：
- `/api/auth/me` 返回当前账号绑定的学生信息
- 登录逻辑不变，不在登录时自动猜测绑定关系

### 3) 成绩管理
修改 [scores.py](/D:/project/student-score-system/backend/app/routers/scores.py)：
- 学生角色访问 `/api/scores` 时：
  - 忽略外部传入的 `student_id`
  - 强制使用 `current_user.student_id`
- 若未绑定学生档案：
  - 返回 400，提示“当前学生账号未绑定学生档案，请联系管理员”
- 若绑定的学生不存在：
  - 返回 400，同样给出清晰错误，避免静默空结果

### 4) 兼容策略
- 不做任何“用户名猜学生”的自动回填或运行时兜底。
- 历史学生账号若未绑定，保留登录能力，但进入成绩模块会得到明确错误提示。

## 前端设计

### 1) 账号管理页
修改 [AccountManage.jsx](/D:/project/student-score-system/frontend/src/pages/AccountManage.jsx)：
- 账号列表新增“绑定学生”展示列，显示：
  - 学生姓名
  - 学号
  - 未绑定时显示 `-`
- 新增/编辑学生账号时：
  - 当角色选择为 `student`，显示“绑定学生”下拉框
  - 非 `student` 角色隐藏并清空绑定项
- 学生下拉数据来源：
  - 读取学生列表接口
  - 建议按学校范围过滤，避免跨校绑定

### 2) 首页节次管理
修改 [Home.jsx](/D:/project/student-score-system/frontend/src/pages/Home.jsx)：
- “节次管理”按钮始终打开同一个弹窗
- 当无节次时，弹窗进入“新增首个节次”模式：
  - 标题改为“新增节次”
  - `name` 可编辑
  - `start_time`、`end_time` 可编辑
  - 新增 `sort_order` 输入项，默认 `1`
  - 确认按钮可用
  - 提交走 `createSchedulePeriod`
- 当已有节次时：
  - 保持当前编辑模式
  - 继续支持时间调整后顺延后续节次
  - 提交走 `updateSchedulePeriod`
- 新增首个节次成功后：
  - 刷新节次列表
  - 自动进入该节次的可编辑状态

## 错误处理

### 学生账号绑定
- 未绑定：返回“当前学生账号未绑定学生档案，请联系管理员”
- 绑定失效：返回“当前学生账号绑定的学生档案不存在，请联系管理员”
- 重复绑定：返回“该学生档案已绑定其他账号”
- 角色非法绑定：返回“仅学生账号可绑定学生档案”

### 首页节次新增
- 空状态提示调整为“暂无节次，请先新增首个节次”
- 新增失败时透传后端错误，避免只显示笼统“操作失败”

## 测试策略

### 后端
1. 学生账号已绑定时，请求 `/api/scores?exam_id=...` 不传 `student_id` 也能返回本人数据。
2. 学生账号未绑定时，`/api/scores` 返回预期 400 和错误信息。
3. 非学生角色原有成绩查询逻辑不回归。
4. 账号更新接口支持绑定/清空 `student_id`，并正确校验唯一性与角色限制。

### 前端
1. 账号管理页能展示并修改学生绑定。
2. 首页在无节次数据时可成功新增首个节次。
3. 首页在已有节次时仍保持现有编辑与顺延逻辑。
4. 新增首个节次后无需刷新页面即可看到结果。

## 影响文件

### 后端
- `backend/app/models/user.py`
- `backend/app/routers/accounts.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/scores.py`
- `backend/app/schemas/auth.py`
- 以及对应 Alembic 迁移文件

### 前端
- `frontend/src/pages/AccountManage.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- 若缺少账号/学生联动 API，则补充对应 `api/*.js`

## 风险与兼容
- 增加 `student_id` 后，历史学生账号需要管理员手工绑定后才能正常进入成绩模块。
- 若一个学校学生数量很多，账号管理页的学生下拉需要注意可搜索性。
- 首页节次弹窗要同时兼容“新增模式”和“编辑模式”，避免把原有编辑流程打断。

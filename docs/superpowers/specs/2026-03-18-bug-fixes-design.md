# Bug 修复与功能增强设计文档

**日期**：2026-03-18
**模块**：学生管理、成绩管理、学生成绩分析、班级成绩分析

---

## 一、学生管理 - 批量导入改进

### 背景
当前批量导入直接上传文件，从 Excel 班级列读取班级名匹配，用户无法预先选择班级，且导入后班级数据依赖 Excel 内容。

### 改动范围

**后端**（`backend/app/routers/students.py`）：
- `POST /api/students/import` 增加可选 Query 参数 `class_id: int | None`
- 若传入 `class_id`，所有导入的学生忽略 Excel 班级列，直接使用该 `class_id`
- 若未传入，保持现有逻辑（从 Excel 读取班级名匹配）

**前端**（`frontend/src/pages/StudentManage.jsx`）：
- "批量导入"按钮改为先弹出 Modal
- Modal 包含：班级下拉框（必选，从现有班级列表加载）+ 文件上传区
- 确认后携带 `class_id` 调用导入接口
- 导入完成后关闭选班 Modal，弹出结果 Modal

---

## 二、成绩管理 - 模板顺序与导入增强

### 2.1 科目顺序调整

**后端 + 前端均需修改**：

旧顺序（后端 `SUBJECT_DISPLAY_ORDER`）：
```
数学, 语文, 英语, 历史, 地理, 生物, 道法
```

新顺序：
```
语文, 数学, 英语, 物理, 生物, 历史, 地理, 道法
```

涉及文件：
- `backend/app/routers/scores.py`：`SUBJECT_DISPLAY_ORDER` 常量
- `frontend/src/pages/ScoreManage.jsx`：`SUBJECT_DISPLAY_ORDER` 常量

### 2.2 成绩导入增强（班级排名/年级排名可选列）

**需求**：若 Excel 文件包含"班级排名"和"年级排名"列，直接使用这些值写入 `TotalRank`；否则调用 `recalculate_ranks` 计算。

**后端**（`backend/app/routers/scores.py` → `import_scores`）：
1. 解析 headers，检测是否存在"班级排名"和"年级排名"列
2. 若两列均存在且当前行有值：导入完成后按学生写入/更新 `TotalRank`（跳过 `recalculate_ranks`）
3. 若缺失或值为空：正常调用 `recalculate_ranks`

---

## 三、成绩列表功能增强

涉及文件：`frontend/src/pages/ScoreManage.jsx`、`backend/app/routers/scores.py`、`frontend/src/api/score.js`

### 3.1 默认总分降序排序
- 后端 `list_scores` 查询 `students` 时，关联 `TotalRank` 按 `total_score DESC` 排序
- 前端 Table 总分列设置 `defaultSortOrder: 'descend'`

### 3.2 按姓名/学号查询
- 列表上方新增搜索区：学号输入框 + 姓名输入框 + 查询按钮（必须已选考试才可点击）
- 后端 `list_scores` 新增过滤参数：`student_no: str | None`（模糊匹配）、`student_name: str | None`（模糊匹配）

### 3.3 每行编辑功能
- 操作列新增"编辑"按钮
- 点击后弹出 Modal，展示所有科目成绩输入框（含当前分数），可逐科修改
- 保存时逐科调用现有 `PUT /api/scores/{score_id}` 接口
- 保存完成后刷新列表

### 3.4 每行删除功能
- 操作列新增"删除"按钮（Popconfirm 确认）
- 删除指定学生在本次考试的所有科目成绩
- 后端新增接口：`DELETE /api/scores/by-student?exam_id={exam_id}&student_id={student_id}`
  - 删除该 `exam_id` + `student_id` 下所有 `Score` 记录
  - 删除后调用 `recalculate_ranks`

### 3.5 多选 + 批量删除
- 表格添加 `rowSelection`（rowKey 为 `student_id`）
- 有选中行时显示"删除所选 (N)" 按钮（Popconfirm 确认）
- 后端新增接口：`DELETE /api/scores/batch-by-students`
  - 请求体：`{ "exam_id": int, "student_ids": [int, ...] }`
  - 批量删除指定学生在该考试的所有成绩
  - 删除后调用 `recalculate_ranks`

---

## 四、学生成绩分析 Bug 修复

涉及文件：`backend/app/routers/analysis.py`、`frontend/src/pages/StudentAnalysis.jsx`、`frontend/src/api/analysis.js`

### 4.1 历史趋势按年级过滤（Bug 修复）

**问题**：学生在其他年级考试中也有成绩记录，导致趋势图出现与当前班级无关的数据点。

**修复**：`total-trend`、`rank-trend`、`subject-trend` 三个接口在查询时，JOIN `Exam` 表并过滤 `exam.grade = 学生所在班级的 grade`，确保只返回同年级考试数据。

### 4.2 各科成绩对比图 - 考试选择下拉框

**改动**：
- `StudentAnalysis.jsx` 内部新增考试下拉框（只显示该学生所在班级 grade 匹配的考试列表，按日期倒序）
- 默认选中最近一次考试
- 替代原来依赖父组件 `examId` prop 的方式（`examId` prop 仍保留，用于初始化默认值）
- 考试下拉框的 options 通过调用现有 `GET /api/exams` 接口获取，前端按 grade 过滤

---

## 五、班级成绩分析修复

涉及文件：`frontend/src/pages/ClassAnalysis.jsx`、`backend/app/routers/analysis.py`

### 5.1 下拉框添加"总分"选项
- 科目选择下拉框首项固定添加 `{ value: null, label: '总分' }`
- 当前已有 `allowClear` + `placeholder="总分"` 但没有对应选项，用户无法主动选择回"总分"
- 修复：将 null（总分）作为列表第一个真实 option

### 5.2 各班柱状图颜色区分
- 移除固定 `color: '#1890ff'`
- 设置 `colorField: 'class_name'`，由图表库自动为每个班级分配不同颜色

### 5.3 图表 Tooltip 中文化 + 修复 undefined
- 配置 `tooltip`:
  ```js
  tooltip: {
    title: (datum) => datum.class_name,
    formatter: (datum) => ({ name: '平均分', value: datum.avg_score?.toFixed(1) ?? '-' }),
  }
  ```
- 去除任何可能导致 `undefined` 的配置项（如未定义的 `title` 字段引用）

### 5.4 成绩分布计算修复

**问题**：`_calc_rates` 对总分和单科使用相同的绝对分阈值（90/80/60），总分通常是几百分，导致几乎所有人都是"优秀"。

**修复方案**：
- **单科分布**：保持绝对分阈值（≥90 优秀、80-89 良好、60-79 合格、<60 不合格）
- **总分分布**：改用百分比阈值
  - 后端计算该班该次考试的理论满分：查询所有参与科目的满分之和（暂定各科满分从科目信息获取，若无配置则从该考试该科最高分推算）
  - 按 `score / max_total * 100` 得出百分比，再按 90/80/60 阈值区间归类
  - 若无法确定满分，降级为按该班本次总分最高值为基准

**实现**：后端 `_calc_rates` 新增可选参数 `max_score`；总分分布调用时传入计算得到的理论满分。

### 5.5 偏科生逻辑重新设计

**新计算逻辑**：
1. 取该班该次考试中 `rank_class <= 40` 的学生（总分排名前40）
2. 计算本班本次考试每科的平均分
3. 对每位前40名学生，检查每科分数是否低于该科班级平均分
4. 若存在任何一科低于平均分，则认定为偏科生，记录所有偏科科目
5. 结果按偏科科目数量降序排列

**前端展示**：
- 表格列从"标准差"改为"偏科科目数"
- "偏科生分析"卡片标题旁加 `<Tooltip>` 小问号图标，说明：
  > "仅统计班级总分排名前 40 名的同学。若某同学任意科目成绩低于本班本次考试该科平均分，则视为偏科生。"

---

## 涉及文件总览

| 文件 | 改动内容 |
|------|---------|
| `backend/app/routers/students.py` | import 接口增加 class_id 参数 |
| `backend/app/routers/scores.py` | 调整 SUBJECT_DISPLAY_ORDER；list_scores 加排序/过滤；新增 by-student 删除、batch-by-students 删除接口；import 增加班级排名/年级排名列处理 |
| `backend/app/routers/analysis.py` | 历史趋势接口按 grade 过滤；_calc_rates 支持 max_score；偏科生逻辑重写 |
| `frontend/src/pages/StudentManage.jsx` | 导入流程改为先选班级 Modal |
| `frontend/src/pages/ScoreManage.jsx` | 调整顺序常量；加搜索/编辑/删除/多选/批量删除 |
| `frontend/src/pages/StudentAnalysis.jsx` | 内部加考试下拉框；历史趋势不再依赖 examId prop |
| `frontend/src/pages/ClassAnalysis.jsx` | 总分选项；颜色；Tooltip；偏科生展示 |
| `frontend/src/api/score.js` | 新增 by-student 删除、batch-by-students 删除 API |
| `frontend/src/api/student.js` | importStudents 支持 class_id 参数 |

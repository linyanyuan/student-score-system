# 成绩分析模块设计文档

**日期**：2026-03-18
**版本**：1.0
**模块**：学生成绩分析 + 班级成绩分析

---

## 1. 背景与目标

在现有学生成绩管理系统基础上，新增成绩分析功能，帮助教师从多维度了解学生学习情况和班级整体水平。分析功能嵌入现有"成绩管理"页面，通过 Tab 切换访问。

---

## 2. 功能范围

### 2.1 学生成绩分析

针对单个学生，提供以下四个维度的可视化分析：

1. **总分历次趋势**：折线图展示该学生历次考试总分变化
2. **单科历次趋势**：可选科目，折线图展示该科目历次成绩变化
3. **名次变化**：折线图展示班级排名和年级排名的历次变化（双线）
4. **各科对比**：雷达图对比学生各科成绩与班级均分、年级均分

### 2.2 班级成绩分析

提供跨班对比和单班深度分析两个视图：

**跨班对比视图**（未选具体班级时）：
- 柱状图展示各班级在指定考试中的总分或指定科目均分排名

**单班深度分析视图**（选中班级后）：
1. **成绩分布**：柱状图展示各科优秀率/良好率/合格率/不合格率
2. **后进生列表**：表格展示总分排名靠后的学生，含各科成绩，弱势科目标红
3. **偏科生列表**：表格展示偏科学生，含各科成绩，偏科科目标红

---

## 3. 技术方案

### 3.1 整体架构

- **后端**：新增 `backend/app/routers/analysis.py`，所有分析逻辑在后端完成，注册到 `main.py`
- **前端**：
  - `frontend/src/api/analysis.js` — API 调用封装
  - `frontend/src/pages/ScoreManage.jsx` — 改造，增加 Tab
  - `frontend/src/pages/StudentAnalysis.jsx` — 学生分析组件
  - `frontend/src/pages/ClassAnalysis.jsx` — 班级分析组件
- **图表库**：`@ant-design/charts`（Line、Radar、Column、Pie）

### 3.2 后端 API 设计

所有接口前缀：`/api/analysis`
权限：复用现有 `get_current_user`、`get_accessible_class_ids` 依赖

#### 学生分析接口

| 接口 | 说明 |
|------|------|
| `GET /api/analysis/student/{student_id}/total-trend` | 总分历次趋势 |
| `GET /api/analysis/student/{student_id}/subject-trend?subject_id=` | 单科历次趋势 |
| `GET /api/analysis/student/{student_id}/rank-trend` | 名次历次变化 |
| `GET /api/analysis/student/{student_id}/subject-comparison?exam_id=` | 各科与均分对比 |

**返回格式示例：**

```json
// total-trend
[{ "exam_name": "期中考试", "exam_date": "2025-11-01", "total_score": 520 }]

// subject-trend
[{ "exam_name": "期中考试", "exam_date": "2025-11-01", "score": 88 }]

// rank-trend
[{ "exam_name": "期中考试", "exam_date": "2025-11-01", "rank_class": 5, "rank_grade": 23 }]

// subject-comparison
[{ "subject_name": "数学", "student_score": 88, "class_avg": 75.2, "grade_avg": 73.8 }]
```

#### 班级分析接口

| 接口 | 说明 |
|------|------|
| `GET /api/analysis/classes/rank?exam_id=&subject_id=` | 班级排名（subject_id 可选） |
| `GET /api/analysis/class/{class_id}/exam/{exam_id}/distribution` | 成绩分布 |
| `GET /api/analysis/class/{class_id}/exam/{exam_id}/bottom-students?limit=10` | 后进生列表 |
| `GET /api/analysis/class/{class_id}/exam/{exam_id}/biased-students` | 偏科生列表 |

**返回格式示例：**

```json
// classes/rank
[{ "class_name": "高三(1)班", "avg_score": 512.3, "rank": 1 }]

// distribution
{
  "total": { "excellent_rate": 0.25, "good_rate": 0.35, "pass_rate": 0.30, "fail_rate": 0.10 },
  "subjects": {
    "数学": { "excellent_rate": 0.20, "good_rate": 0.40, "pass_rate": 0.25, "fail_rate": 0.15 }
  }
}

// bottom-students
[{ "student_name": "张三", "total_score": 320, "rank_class": 45, "subjects": {"数学": 42}, "weak_subjects": ["数学", "英语"] }]

// biased-students
[{ "student_name": "李四", "subjects": {"数学": 98, "语文": 55}, "std_dev": 18.5, "weak_subject": "语文" }]
```

### 3.3 偏科判断算法

```
个人标准差 = std([各科成绩])
班级平均标准差 = mean([每个学生的个人标准差])
偏科条件：个人标准差 > 班级平均标准差 × 1.5
弱势科目：该生成绩最低的科目
```

### 3.4 成绩分布阈值

| 等级 | 条件 |
|------|------|
| 优秀 | 分数 ≥ 90 |
| 良好 | 80 ≤ 分数 < 90 |
| 合格 | 60 ≤ 分数 < 80 |
| 不合格 | 分数 < 60 |

---

## 4. 前端页面设计

### 4.1 ScoreManage.jsx 改造

顶部增加 Ant Design `Tabs` 组件，3 个 Tab：
- `成绩列表`（现有内容不变）
- `学生成绩分析`
- `班级成绩分析`

Tab 切换时保留已选 `exam_id`。成绩列表每行增加"分析"按钮，点击后切换到学生分析 Tab 并带入 `student_id`。

### 4.2 StudentAnalysis.jsx

**筛选栏**：考试选择器 + 学号/姓名搜索下拉（支持模糊搜索，从成绩列表点击可自动填入）

**图表布局**（2×2 网格，使用 Ant Design Row/Col）：

| 位置 | 图表 | 组件 |
|------|------|------|
| 左上 | 总分历次趋势 | `<Line>` |
| 右上 | 单科历次趋势（含科目选择器） | `<Line>` |
| 左下 | 名次变化（班级+年级双线） | `<Line>` |
| 右下 | 各科对比雷达图 | `<Radar>` |

### 4.3 ClassAnalysis.jsx

**筛选栏**：考试选择器 + 班级选择器（可选）+ 科目选择器（跨班对比时可选）

**未选班级**：`<Column>` 柱状图展示各班均分排名

**选中班级后**，展示 3 个卡片：
1. 成绩分布：`<Column>` 分组柱状图（各科 × 4个等级）
2. 后进生：`<Table>`，弱势科目单元格红色背景
3. 偏科生：`<Table>`，偏科科目单元格红色背景

---

## 5. 权限控制

| 角色 | 学生分析 | 班级分析 |
|------|----------|----------|
| admin | 所有学生 | 所有班级 |
| teacher | 所教班级的学生 | 所教班级 |
| student | 仅本人 | 不可访问 |

学生角色访问班级分析接口时返回 403。

---

## 6. 不在范围内

- 成绩预测/AI 分析
- 分析报告导出（PDF/Excel）
- 历史分析数据缓存
- 偏科阈值自定义配置

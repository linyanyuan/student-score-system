# Bug 修复设计文档

**日期**：2026-03-19
**模块**：成绩管理、学生成绩分析、班级成绩分析
**状态**：已完成

---

## 一、成绩管理模块 Bug 修复

### 1.1 编辑功能报错 400 ✅

**问题**：编辑成绩时调用 `createScore` 接口，后端返回 400 错误 "该学生此科目成绩已录入"。

**修复**：
- 后端新增 `PUT /api/scores/upsert` 接口，支持创建或更新成绩
- 前端 `handleEdit` 改用 `upsertScore` 接口

### 1.2 删除功能报错 422 ✅

**问题**：批量删除报错 422。

**修复**：
- 后端批量删除接口改用 Pydantic schema `BatchDeleteScoresRequest`
- 路由改为 `POST /api/scores/batch-by-students/delete`（避免 DELETE 带 body 的兼容性问题）

---

## 二、学生成绩分析模块 Bug 修复

### 2.1 从成绩列表切换时报错 422 ✅

**修复**：
- 前端在调用 API 前验证 `studentId` 是否为有效数字
- 添加 `typeof studentId !== 'number'` 检查

### 2.2 选择学生没数据 ✅

**修复**：
- 添加错误处理 `.catch()` 确保异常时清空数据
- 确保数据加载状态正确显示

### 2.3 默认不显示分析数据 ✅

**已有逻辑**：`!studentId ? <Empty description="请选择学生" />` 正常工作

### 2.4 名次变化图表颜色区分 ✅

**修复**：
```javascript
color: ['#1890ff', '#52c41a'],  // 班级排名蓝色，年级排名绿色
```

### 2.5 工具提示中文化 ✅

**修复**：
```javascript
tooltip: {
  title: (d) => d.exam_name,
  formatter: (d) => ({ name: '总分', value: d.total_score }),
}
```

---

## 三、班级成绩分析模块 Bug 修复

### 3.1 科目下拉框改为复选框 ✅

**修复**：
- 使用 `Checkbox.Group` 替代 `Select`
- 支持多选科目，柱状图按选中科目分组显示
- 不选时显示总分排名

### 3.2 柱状图顶部显示 undefined ✅

**修复**：
```javascript
label: {
  position: 'top',
  formatter: (datum) => {
    const score = datum?.avg_score
    return score !== undefined && score !== null ? score.toFixed(1) : '-'
  },
}
```

### 3.3 工具提示显示科目+分数 ✅

**修复**：
```javascript
tooltip: {
  title: (datum) => datum?.class_name || '-',
  formatter: (datum) => ({
    name: datum?.subject_name || '平均分',
    value: datum?.avg_score?.toFixed(1) ?? '-',
  }),
}
```

### 3.4 成绩分布没数据 ✅

**修复**：
- 添加错误处理和数据清空逻辑
- 修复 DistributionChart 组件的空数据判断

---

## 涉及文件总览

| 文件 | 改动内容 |
|------|---------|
| `backend/app/routers/scores.py` | 新增 upsert 接口；batch-by-students 改用 schema 和 POST 方法 |
| `backend/app/schemas/score.py` | 新增 BatchDeleteScoresRequest |
| `frontend/src/api/score.js` | 新增 upsertScore API；修改批量删除路径 |
| `frontend/src/pages/ScoreManage.jsx` | handleEdit 改用 upsertScore |
| `frontend/src/pages/StudentAnalysis.jsx` | 颜色区分、工具提示中文化、数据验证 |
| `frontend/src/pages/ClassAnalysis.jsx` | 科目多选、柱状图修复、工具提示修复、成绩分布修复 |

# 班级分析排行榜与首页节次管理迭代 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将班级分析中的科目排名与三率一分改为排行榜视图，并修复首页“节次管理”点击无响应问题。

**Architecture:** 后端新增“按考试+科目返回各班三率一分排行”接口，前端用单科下拉驱动两块排行榜展示。三率一分继续复用已有“年级分母口径+满分可配置口径”。首页节次管理在无节次场景下也保证可反馈。

**Tech Stack:** FastAPI, SQLAlchemy, React, Ant Design

---

### Task 1: 三率一分排行榜后端接口（TDD）

**Files:**
- Modify: `backend/app/routers/analysis.py`
- Modify: `backend/tests/test_class_three_rates_one_score.py`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 新增接口 `/api/analysis/exam/{exam_id}/subject/{subject_id}/three-rates-one-score-rank`**
- [ ] **Step 3: 计算 `total_score` 并按其降序返回**
- [ ] **Step 4: 运行测试变绿（GREEN）**

Run: `cd backend; python -m unittest tests.test_class_three_rates_one_score tests.test_scores_import_grade -v`
Expected: PASS

### Task 2: 科目排名前端改造为单科排行榜

**Files:**
- Modify: `frontend/src/pages/ClassAnalysis.jsx`

- [ ] **Step 1: 去掉“多科复选+分组柱图”状态与逻辑**
- [ ] **Step 2: 新增“单科下拉 + 横向排行榜”逻辑**
- [ ] **Step 3: 样式与班级平均分排名对齐**

Run: `cd frontend; cmd /c npm run build`
Expected: PASS

### Task 3: 三率一分前端改造为班级维度排行榜

**Files:**
- Modify: `frontend/src/api/analysis.js`
- Modify: `frontend/src/pages/ClassAnalysis.jsx`

- [ ] **Step 1: 新增三率一分排行榜 API 方法**
- [ ] **Step 2: 三率一分模块默认显示于两张排名图下方**
- [ ] **Step 3: 新增科目下拉，默认第一门科目，不含“总分”选项**
- [ ] **Step 4: 表格增加“总分数”列并按总分数降序展示**

Run: `cd frontend; cmd /c npm run build`
Expected: PASS

### Task 4: 首页“节次管理”无响应修复

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: 点击“节次管理”始终打开弹窗**
- [ ] **Step 2: 无节次时给出可操作提示（不再静默无响应）**
- [ ] **Step 3: 验证 school_admin 角色交互路径**

Run: `cd frontend; cmd /c npm run build`
Expected: PASS

### Task 5: 全量验证

**Files:**
- Modify: `backend/app/routers/analysis.py`
- Modify: `backend/tests/test_class_three_rates_one_score.py`
- Modify: `frontend/src/api/analysis.js`
- Modify: `frontend/src/pages/ClassAnalysis.jsx`
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: 后端测试**
Run: `cd backend; python -m unittest tests.test_class_three_rates_one_score tests.test_scores_import_grade -v`
Expected: PASS

- [ ] **Step 2: 前端构建**
Run: `cd frontend; cmd /c npm run build`
Expected: PASS

- [ ] **Step 3: 变更检查**
Run: `git status --short`
Expected: 仅包含本次相关改动

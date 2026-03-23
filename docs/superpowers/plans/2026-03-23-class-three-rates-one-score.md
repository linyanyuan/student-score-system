# 班级分析三率一分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在班级分析中新增“三率一分”模块，并在成绩分布下展示每科优秀率分数、良好率分数、及格率分数、平均分。

**Architecture:** 后端新增独立接口计算班级三率一分，前端新增 API 并在 ClassAnalysis 新增表格卡片。计算时按用户可见班级范围比较每科达标人数，归一化得到 0-100 分。

**Tech Stack:** FastAPI, SQLAlchemy, React, Ant Design

---

### Task 1: TDD 编写后端计算逻辑失败测试

**Files:**
- Create: `backend/tests/test_class_three_rates_one_score.py`
- Test: `backend/tests/test_class_three_rates_one_score.py`

- [ ] **Step 1: 写阈值计数测试（RED）**
- [ ] **Step 2: 写按最大人数归一化测试（RED）**
- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend; python -m pytest tests/test_class_three_rates_one_score.py -q`
Expected: FAIL（函数尚未实现）

### Task 2: 后端实现三率一分计算与接口

**Files:**
- Modify: `backend/app/routers/analysis.py`
- Test: `backend/tests/test_class_three_rates_one_score.py`

- [ ] **Step 1: 增加三率一分计算辅助函数**
- [ ] **Step 2: 新增接口 `/class/{class_id}/exam/{exam_id}/three-rates-one-score`**
- [ ] **Step 3: 运行新增测试验证通过**

Run: `cd backend; python -m pytest tests/test_class_three_rates_one_score.py -q`
Expected: PASS

### Task 3: 前端接入与展示

**Files:**
- Modify: `frontend/src/api/analysis.js`
- Modify: `frontend/src/pages/ClassAnalysis.jsx`

- [ ] **Step 1: 新增前端 API 方法**
- [ ] **Step 2: 在班级分析请求链中拉取三率一分数据**
- [ ] **Step 3: 在成绩分布下方新增表格卡片展示**

Run: `cd frontend; npm run build`
Expected: PASS

### Task 4: 全量验证

**Files:**
- Modify: `backend/app/routers/analysis.py`
- Modify: `frontend/src/api/analysis.js`
- Modify: `frontend/src/pages/ClassAnalysis.jsx`
- Create: `backend/tests/test_class_three_rates_one_score.py`

- [ ] **Step 1: 后端测试**
Run: `cd backend; python -m pytest tests/test_class_three_rates_one_score.py tests/test_scores_import_grade.py -q`
Expected: PASS

- [ ] **Step 2: 前端构建**
Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 3: 变更自检**
Run: `git status --short`
Expected: 包含本次功能相关文件

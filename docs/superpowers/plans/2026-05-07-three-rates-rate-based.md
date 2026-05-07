# 三率一分率口径调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将班级成绩分析的三率一分改为率口径归一化，并新增低分率得分。

**Architecture:** 复用 `backend/app/routers/analysis.py` 中已有满分配置、年级分组与排序接口。纯函数 `_calc_three_rate_scores` 增加导入人数分母和低分率得分，接口层按考试统计各班导入学生数传入。前端只新增表格列，不改变数据加载方式。

**Tech Stack:** FastAPI, SQLAlchemy, Python unittest, React, Ant Design.

---

### Task 1: 后端测试

**Files:**
- Modify: `backend/tests/test_class_three_rates_one_score.py`

- [ ] **Step 1: 写失败测试**

覆盖优秀阈值 80%、三率按率归一化、分母使用导入人数、低分率排名和并列。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend; python -m unittest tests.test_class_three_rates_one_score -v`

### Task 2: 后端实现

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: 扩展 `_calc_three_rate_scores`**

增加 `class_total_counts` 参数，按率计算三率分数，计算 `low_rate_score`。

- [ ] **Step 2: 更新接口调用**

排行榜接口和旧班级接口都按考试统计各班导入人数后传入纯函数。

- [ ] **Step 3: 运行后端测试**

Run: `cd backend; python -m unittest tests.test_class_three_rates_one_score tests.test_scores_import_grade -v`

### Task 3: 前端展示

**Files:**
- Modify: `frontend/src/pages/ClassAnalysis.jsx`
- Modify: `frontend/src/pages/analysisComparisonContent.test.mjs`

- [ ] **Step 1: 新增低分率得分列**

在 `threeRateColumns` 中新增 `low_rate_score` 列。

- [ ] **Step 2: 增加前端静态测试断言**

检查页面源码包含低分率得分列。

- [ ] **Step 3: 运行前端测试**

Run: `cd frontend; node src/pages/analysisComparisonContent.test.mjs`

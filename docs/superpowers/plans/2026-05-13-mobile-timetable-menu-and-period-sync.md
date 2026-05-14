# Mobile Timetable Menu and Period Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 web 和移动端的节次时间来源，重做移动端课表页左上角菜单，并补齐 `备忘录` 和 `我的概览` 两个功能入口。

**Architecture:** 后端把节次与概览统计做成单一可信来源，移动端课表页只消费后端返回的时间字段，不再用本地节次表兜底。左上角菜单采用底部弹层，菜单项分别进入备忘录页和概览页，避免和底部导航、个人中心重复。web 端同步收紧节次渲染逻辑，确保不会再自己“猜时间”。

**Tech Stack:** FastAPI, SQLAlchemy, Flutter, Riverpod, GoRouter, React

---

### Task 1: 后端新增我的概览聚合接口

**Files:**
- Create: `backend/app/schemas/overview.py`
- Create: `backend/app/routers/overview.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_overview_api.py`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 实现角色化概览响应模型和路由**
- [ ] **Step 3: 按教师/学校管理员分别汇总班级数、学生数、最近考试平均分**
- [ ] **Step 4: 运行后端测试直到通过（GREEN）**

Run: `cd backend; python -m pytest backend/tests/test_overview_api.py -v`
Expected: PASS

### Task 2: 移动端补齐备忘录与概览的数据层

**Files:**
- Modify: `D:/project/student-score-mobile/lib/data/models.dart`
- Modify: `D:/project/student-score-mobile/lib/data/services/api_service.dart`
- Modify: `D:/project/student-score-mobile/lib/data/services/dio_api_service.dart`
- Modify: `D:/project/student-score-mobile/lib/data/repositories/repositories.dart`
- Modify: `D:/project/student-score-mobile/lib/application/providers.dart`
- Create: `D:/project/student-score-mobile/test/memo_repository_test.dart`
- Create: `D:/project/student-score-mobile/test/overview_repository_test.dart`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 增加备忘录模型与 CRUD API 适配**
- [ ] **Step 3: 增加我的概览数据模型与仓库方法**
- [ ] **Step 4: 运行 Flutter 单测直到通过（GREEN）**

Run: `cd D:/project/student-score-mobile; flutter test test/memo_repository_test.dart test/overview_repository_test.dart`
Expected: PASS

### Task 3: 重做移动端课表页左上角菜单

**Files:**
- Modify: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_page.dart`
- Create: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_menu_sheet.dart`
- Create: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_memo_page.dart`
- Create: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_overview_page.dart`
- Modify: `D:/project/student-score-mobile/lib/app/router.dart`
- Create: `D:/project/student-score-mobile/test/timetable_menu_sheet_test.dart`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 去掉右上角按钮，保留左上角菜单按钮**
- [ ] **Step 3: 菜单入口只保留备忘录和我的概览**
- [ ] **Step 4: 接好路由和页面跳转**
- [ ] **Step 5: 运行 Flutter widget 测试**

Run: `cd D:/project/student-score-mobile; flutter test test/timetable_menu_sheet_test.dart`
Expected: PASS

### Task 4: 统一移动端课表时间和课间休息逻辑

**Files:**
- Modify: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_page.dart`
- Create: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_period_utils.dart`
- Modify: `D:/project/student-score-mobile/test/timetable_display_test.dart`
- Create: `D:/project/student-score-mobile/test/timetable_period_utils_test.dart`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 删除本地固定节次时间兜底**
- [ ] **Step 3: 基于相邻节次真实时间差插入课间分隔**
- [ ] **Step 4: 运行 Flutter 测试直到通过（GREEN）**

Run: `cd D:/project/student-score-mobile; flutter test test/timetable_period_utils_test.dart test/timetable_display_test.dart`
Expected: PASS

### Task 5: web 端收紧节次渲染口径

**Files:**
- Modify: `frontend/src/pages/homePeriodUtils.js`
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/homePeriodUtils.test.mjs`

- [ ] **Step 1: 写失败测试（RED）**
- [ ] **Step 2: 保证 web 端只按后端节次数据渲染，不再猜时间**
- [ ] **Step 3: 让缺失节次数据时显示明确空态，而不是伪造时间**
- [ ] **Step 4: 运行 web 测试和构建**

Run: `cd frontend; node --test src/pages/homePeriodUtils.test.mjs`
Expected: PASS

Run: `cd frontend; npm run build`
Expected: PASS

### Task 6: 全量回归

**Files:**
- Modify: `backend/app/routers/overview.py`
- Modify: `backend/app/main.py`
- Modify: `D:/project/student-score-mobile/lib/presentation/timetable/timetable_page.dart`
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: 跑后端接口测试**
- [ ] **Step 2: 跑移动端 Flutter 测试**
- [ ] **Step 3: 跑前端构建**
- [ ] **Step 4: 检查工作区只保留本次改动**

Run: `git status --short`
Expected: 只看到本次相关文件

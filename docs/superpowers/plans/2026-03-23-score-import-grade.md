# 成绩年级导入与教师可见范围调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持按年级导入成绩（含表头别名自动识别）并修复教师在成绩模块的年级可见范围。

**Architecture:** 在现有 `/api/scores/import` 上新增 `grade` 参数和导入校验逻辑，不新开接口。权限放开仅针对成绩相关查询路径，按“考试年级”动态确定教师可见班级集合，并同步前端导入交互。保留现有排名重算链路，避免破坏已上线行为。

**Tech Stack:** FastAPI, SQLAlchemy, openpyxl, React, Ant Design

---

### Task 1: 先写失败测试覆盖导入与可见范围

**Files:**
- Create: `backend/tests/test_scores_import_grade.py`
- Modify: `backend/requirements.txt`（如缺少测试依赖）
- Test: `backend/tests/test_scores_import_grade.py`

- [ ] **Step 1: 写导入年级校验失败测试（RED）**

```python
def test_import_reject_when_grade_not_in_exam_grades(...):
    resp = client.post("/api/scores/import?exam_id=1&grade=高三", ...)
    assert resp.status_code == 400
```

- [ ] **Step 2: 写表头别名导入成功测试（RED）**

```python
def test_import_accept_alias_headers(...):
    # 使用“政治/总分班名/总分总名”等别名
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 1
```

- [ ] **Step 3: 写教师年级可见范围测试（RED）**

```python
def test_teacher_can_list_all_classes_in_exam_grade(...):
    resp = client.get("/api/scores?exam_id=1", headers=teacher_auth)
    assert len(resp.json()["items"]) == expected
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd backend; python -m pytest tests/test_scores_import_grade.py -q`
Expected: FAIL（缺少新逻辑导致断言失败）

### Task 2: 后端实现导入年级校验和别名识别

**Files:**
- Modify: `backend/app/routers/scores.py`
- Test: `backend/tests/test_scores_import_grade.py`

- [ ] **Step 1: 增加导入年级参数与考试年级一致性校验**
- [ ] **Step 2: 增加 Excel 表头别名归一与识别**
- [ ] **Step 3: 增加学生行级年级校验**
- [ ] **Step 4: 运行针对测试**

Run: `cd backend; python -m pytest tests/test_scores_import_grade.py -q`
Expected: PASS（导入相关用例通过）

### Task 3: 后端实现教师按考试年级可见范围

**Files:**
- Modify: `backend/app/routers/scores.py`
- Modify: `backend/app/routers/analysis.py`
- Test: `backend/tests/test_scores_import_grade.py`

- [ ] **Step 1: 提取“教师考试年级可见班级ID”辅助逻辑**
- [ ] **Step 2: 在成绩列表查询应用该逻辑**
- [ ] **Step 3: 在成绩分析接口应用同逻辑（避免行为不一致）**
- [ ] **Step 4: 运行测试**

Run: `cd backend; python -m pytest tests/test_scores_import_grade.py -q`
Expected: PASS

### Task 4: 前端导入交互改造

**Files:**
- Modify: `frontend/src/api/score.js`
- Modify: `frontend/src/pages/ScoreManage.jsx`
- Test: `frontend/src/pages/ScoreManage.jsx`（手工验证）

- [ ] **Step 1: API 增加 `grade` 参数**
- [ ] **Step 2: 成绩页新增“导入年级”选择并联动考试参与年级**
- [ ] **Step 3: 上传前校验考试与导入年级**
- [ ] **Step 4: 本地构建检查**

Run: `cd frontend; npm run build`
Expected: BUILD SUCCESS

### Task 5: 全量验证

**Files:**
- Modify: `backend/app/routers/scores.py`
- Modify: `backend/app/routers/analysis.py`
- Modify: `frontend/src/api/score.js`
- Modify: `frontend/src/pages/ScoreManage.jsx`
- Test: `backend/tests/test_scores_import_grade.py`

- [ ] **Step 1: 后端测试**

Run: `cd backend; python -m pytest tests/test_scores_import_grade.py -q`
Expected: PASS

- [ ] **Step 2: 前端构建**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 3: git diff 自检并输出变更清单**

Run: `git status --short`
Expected: 仅包含本次功能相关文件

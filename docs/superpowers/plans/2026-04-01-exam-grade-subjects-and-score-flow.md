# Exam Grade Subjects And Score Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add exam-grade-subject configuration and make score entry, editing, import, and export respect the configured subjects for each grade in each exam.

**Architecture:** Keep exam grade participation in the existing `Exam.grade` field for compatibility, and add a normalized `exam_grade_subjects` table to represent the actual subjects each grade takes in each exam. Build one shared backend resolver for "exam + grade -> subjects", then wire score APIs and the two management pages to consume that source of truth.

**Tech Stack:** FastAPI, SQLAlchemy ORM, SQLite compatibility layer, Ant Design, React, openpyxl, unittest, node-based source checks

---

### Task 1: Add failing backend tests for exam-grade-subject persistence

**Files:**
- Create: `backend/tests/test_exam_grade_subject_api.py`
- Modify: `backend/app/models/exam.py`
- Modify: `backend/app/schemas/exam.py`
- Modify: `backend/app/routers/exams.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Write failing tests for creating and updating exam grade-subject mappings**

- [ ] **Step 2: Run the targeted backend test file and verify it fails for the expected missing behavior**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: FAIL with missing model fields, missing response shape, or missing persistence behavior

- [ ] **Step 3: Implement the normalized model, schema, SQLite compatibility, and exam router persistence**

- [ ] **Step 4: Re-run the targeted backend test file and verify it passes**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: PASS

### Task 2: Add failing backend tests for score subject scoping

**Files:**
- Modify: `backend/tests/test_exam_grade_subject_api.py`
- Modify: `backend/app/routers/scores.py`

- [ ] **Step 1: Add failing tests for student subject lookup and score create/update validation**

- [ ] **Step 2: Run the targeted backend test file and verify it fails for the expected missing score constraints**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: FAIL with missing subject lookup endpoint or missing validation

- [ ] **Step 3: Implement shared exam-grade-subject resolution in the score router and enforce it in entry/update flows**

- [ ] **Step 4: Re-run the targeted backend test file and verify it passes**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: PASS

### Task 3: Add failing backend tests for export by grade sheets

**Files:**
- Modify: `backend/tests/test_exam_grade_subject_api.py`
- Modify: `backend/app/routers/scores.py`

- [ ] **Step 1: Add a failing export test asserting one sheet per grade and grade-specific subject headers**

- [ ] **Step 2: Run the targeted backend test file and verify it fails for the current single-sheet export**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: FAIL because export still uses one sheet with all subjects

- [ ] **Step 3: Implement grade-split Excel export using exam-grade-subject mappings**

- [ ] **Step 4: Re-run the targeted backend test file and verify it passes**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api -v`
Expected: PASS

### Task 4: Add failing frontend checks for exam manage and score manage source behavior

**Files:**
- Create: `frontend/src/pages/examGradeSubjectsContent.test.mjs`
- Create: `frontend/src/pages/scoreManageExamGradeSubjects.test.mjs`
- Modify: `frontend/src/pages/ExamManage.jsx`
- Modify: `frontend/src/pages/ScoreManage.jsx`
- Modify: `frontend/src/api/exam.js`
- Modify: `frontend/src/api/score.js`

- [ ] **Step 1: Add failing source-level tests for grade-subject form sections, student-first score entry, import modal grade picker, and table-header-based editing**

- [ ] **Step 2: Run the targeted node checks and verify they fail for the expected missing UI structures**

Run: `node frontend/src/pages/examGradeSubjectsContent.test.mjs`
Expected: FAIL

Run: `node frontend/src/pages/scoreManageExamGradeSubjects.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement the frontend API shape changes and page behavior updates**

- [ ] **Step 4: Re-run the targeted node checks and verify they pass**

Run: `node frontend/src/pages/examGradeSubjectsContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/scoreManageExamGradeSubjects.test.mjs`
Expected: PASS

### Task 5: Run regression verification for touched backend and frontend flows

**Files:**
- Modify: `backend/tests/test_scores_import_grade.py`
- Modify: `frontend/src/pages/examManageWorkspaceContent.test.mjs`
- Modify: `frontend/src/pages/scoreManageChineseFilters.test.mjs`

- [ ] **Step 1: Update any affected regression checks to match the new source of truth**

- [ ] **Step 2: Run focused verification commands**

Run: `python -m unittest backend.tests.test_exam_grade_subject_api backend.tests.test_scores_import_grade -v`
Expected: PASS

Run: `node frontend/src/pages/examManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/scoreManageChineseFilters.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/examGradeSubjectsContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/scoreManageExamGradeSubjects.test.mjs`
Expected: PASS

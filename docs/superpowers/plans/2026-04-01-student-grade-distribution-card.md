# Student Grade Distribution Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the student workspace “current result” metric card with a stable grade-distribution summary card based on all students visible to the current account.

**Architecture:** Keep the existing student list behavior unchanged, add a lightweight full-scope student fetch for metric aggregation, and compute ordered grade counts client-side from `students -> class_id -> classes.grade`. Reuse the existing workspace metric card UI and add focused regression coverage for the new summary copy.

**Tech Stack:** React, Ant Design, existing workspace metric cards, Node-based source regression tests

---

### Task 1: Add the failing regression test for the grade-distribution metric copy

**Files:**
- Modify: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions for:
- `gradeDistribution`
- `年级分布`
- removal of `当前结果`

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: FAIL because `StudentManage.jsx` still renders the old current-result metric.

- [ ] **Step 3: Write minimal implementation**

Update the student metric computation and card copy to render the grade-distribution summary instead of the current-result card.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StudentManage.jsx frontend/src/pages/studentManageCustomFieldDrawer.test.mjs
git commit -m "feat: show grade distribution in student metrics"
```

### Task 2: Compute full-scope grade counts for the student workspace

**Files:**
- Modify: `frontend/src/pages/StudentManage.jsx`
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`

- [ ] **Step 1: Write the failing test**

Assert that the page now contains:
- a `gradeDistribution` data path
- helper text describing grade counts
- no `当前结果` metric copy

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: FAIL because the metric state and copy are not yet updated.

- [ ] **Step 3: Write minimal implementation**

In `StudentManage.jsx`:
- add a full-scope student fetch for metric aggregation
- map `class_id` to `grade`
- sort grade labels with a stable grade-rank helper
- build one summary string for the metric helper text

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StudentManage.jsx frontend/src/pages/studentManageCustomFieldDrawer.test.mjs
git commit -m "feat: aggregate student grade distribution"
```

### Task 3: Run focused verification

**Files:**
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
- Test: `frontend/src/pages/pageSyntaxSmoke.test.mjs`

- [ ] **Step 1: Run the student workspace regression test**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 2: Run syntax smoke**

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 3: Review the targeted diff**

Run: `git diff -- frontend/src/pages/StudentManage.jsx frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: only metric-card aggregation and copy changes.

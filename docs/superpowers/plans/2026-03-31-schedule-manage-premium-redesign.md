# Schedule Manage Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Schedule Manage page into a premium scheduling control panel without changing the existing scheduling APIs or workflow.

**Architecture:** Keep the current data-loading, save, solve, publish, and preview flow intact, but replace the page shell with a stronger summary-to-detail layout. Move presentation-heavy calculations into `scheduleManageUtils.js` so overview metrics, warnings, and draft status summaries are testable and reusable.

**Tech Stack:** React 19, Ant Design 6, Vite, existing scheduling REST APIs, lightweight Node-based utility tests

---

### Task 1: Lock The Presentation Rules In Tests

**Files:**
- Modify: `frontend/src/pages/scheduleManageUtils.test.mjs`
- Modify: `frontend/src/pages/scheduleManageUtils.js`

- [ ] **Step 1: Write the failing test**

Add assertions for:
- summary counts ignoring placeholder rows
- warnings based on missing real data instead of array length
- draft/task helper output for success, pending, and empty states

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL because the new helper behavior does not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement pure helpers in `frontend/src/pages/scheduleManageUtils.js` for:
- normalized timetable row labels
- meaningful row counting
- config warnings
- draft status / readiness summary

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "test: lock schedule manage presentation helpers"
```

### Task 2: Rebuild The Page Shell And Work Surfaces

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Reference: `docs/superpowers/specs/2026-03-31-schedule-manage-premium-redesign-design.md`

- [ ] **Step 1: Write the failing test**

Reuse the utility-driven checks from Task 1 as the guardrail for the new UI state presentation.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS before UI edits, remaining green during refactor

- [ ] **Step 3: Write minimal implementation**

Refactor `frontend/src/pages/ScheduleManage.jsx` to include:
- a premium command header
- KPI overview cards
- guided readiness / warning panel
- a left-side configuration workspace
- a right-side draft review workspace
- clearer section cards for plans, arrangements, constraints, and locks

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run build`
Expected: PASS with the redesigned page compiling successfully

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx
git commit -m "feat: redesign schedule manage workspace"
```

### Task 3: Final Verification

**Files:**
- Verify: `frontend/src/pages/ScheduleManage.jsx`
- Verify: `frontend/src/pages/scheduleManageUtils.js`
- Verify: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: Run focused tests**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

- [ ] **Step 2: Run build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 3: Review UX regressions**

Check that:
- save / solve / publish actions still exist
- current draft only reflects the current task result
- no fake history UI is introduced
- the page remains usable on desktop and mobile widths

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-03-31-schedule-manage-premium-redesign.md
git commit -m "docs: add schedule manage premium redesign plan"
```

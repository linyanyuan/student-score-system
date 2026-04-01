# Student Custom Field Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move custom field management into the student management page, using a right-side drawer and modal-based create/edit flows while keeping student list operations as the primary workspace.

**Architecture:** Keep the existing backend API unchanged and consolidate the frontend entry point into `StudentManage.jsx`. Remove the standalone route and menu item for custom fields, add a drawer-hosted field list inside the student workspace, and cover the change with focused frontend regression tests plus syntax smoke verification.

**Tech Stack:** React, Ant Design, React Router, existing workspace UI components, Node-based source regression tests, Vite syntax transform smoke test

---

### Task 1: Add the failing regression test for the new student-page field-management entry

**Files:**
- Create: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
assert.match(source, /Drawer/)
assert.match(source, /getCustomFields/)
assert.ok(includesEither(String.raw`\u6dfb\u52a0\u81ea\u5b9a\u4e49\u5b57\u6bb5`))
assert.ok(includesEither(String.raw`\u81ea\u5b9a\u4e49\u5b57\u6bb5`))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: FAIL because `StudentManage.jsx` does not yet contain the drawer-based field-management workspace copy and structure.

- [ ] **Step 3: Write minimal implementation**

Implement the student-page drawer entry, the drawer-hosted field list, and modal triggers in `StudentManage.jsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/studentManageCustomFieldDrawer.test.mjs frontend/src/pages/StudentManage.jsx
git commit -m "feat: embed custom field drawer into student management"
```

### Task 2: Remove the standalone menu and route entry for custom fields

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/MainLayout.jsx`
- Test: `frontend/src/components/mainLayoutWorkspaceShell.test.mjs`

- [ ] **Step 1: Write the failing test**

Extend or add an assertion that the workspace shell no longer exposes `/custom-fields` in the school admin menu.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: FAIL because the menu still includes the standalone custom-field item.

- [ ] **Step 3: Write minimal implementation**

Remove the `CustomFieldManage` route import and route registration from `App.jsx`, then remove the `/custom-fields` menu item from `MainLayout.jsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/MainLayout.jsx frontend/src/components/mainLayoutWorkspaceShell.test.mjs
git commit -m "refactor: remove standalone custom field navigation"
```

### Task 3: Refresh the student workspace layout and field-management interactions

**Files:**
- Modify: `frontend/src/pages/StudentManage.jsx`
- Modify: `frontend/src/pages/pageSyntaxSmoke.test.mjs`
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
- Test: `frontend/src/pages/pageSyntaxSmoke.test.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions for workspace header usage, drawer visibility state, field modal state, and explanatory copy about field impact.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: FAIL because the current student page uses the older plain layout and has no dedicated field-management workspace messaging.

- [ ] **Step 3: Write minimal implementation**

Refactor `StudentManage.jsx` to:
- use workspace page sections like class management
- keep student list as the main section
- expose a header action to open the custom-field drawer
- host create/edit/delete field operations inside the student page
- refresh field definitions after field mutations

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StudentManage.jsx frontend/src/pages/studentManageCustomFieldDrawer.test.mjs frontend/src/pages/pageSyntaxSmoke.test.mjs
git commit -m "feat: redesign student workspace with field drawer"
```

### Task 4: Run final verification for the affected frontend surface

**Files:**
- Test: `frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
- Test: `frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
- Test: `frontend/src/pages/pageSyntaxSmoke.test.mjs`

- [ ] **Step 1: Run targeted regression tests**

Run: `node frontend/src/pages/studentManageCustomFieldDrawer.test.mjs`
Expected: PASS

- [ ] **Step 2: Run shell navigation regression**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: PASS

- [ ] **Step 3: Run page syntax smoke**

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 4: Review changed files**

Run: `git diff -- frontend/src/App.jsx frontend/src/components/MainLayout.jsx frontend/src/pages/StudentManage.jsx frontend/src/pages/studentManageCustomFieldDrawer.test.mjs frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: only the planned navigation and student-page consolidation changes.

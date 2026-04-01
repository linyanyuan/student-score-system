# Teacher Management Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the teacher management module into a workspace-style page that matches Home and Subject Manage while preserving all existing teacher binding and subject-assignment behavior.

**Architecture:** Keep the existing teacher/class/subject data flow and assignment APIs intact, but reorganize [`frontend/src/pages/TeacherClassManage.jsx`](d:/project/student-score-system/frontend/src/pages/TeacherClassManage.jsx) into a `workspace-page` shell with a header, metric cards, a primary workflow area, and result sections. Add one focused page-structure regression test and minimal page-specific CSS in [`frontend/src/index.css`](d:/project/student-score-system/frontend/src/index.css) for the new layout.

**Tech Stack:** React, Ant Design, existing workspace components, global workspace CSS tokens, Node-based source regression tests, Vite build verification

---

## File Map

- Modify: `frontend/src/pages/TeacherClassManage.jsx`
  Responsibility: move the page from legacy `Card + Table` stacking into a workspace layout, derive metrics and current-teacher context, and preserve all existing assignment workflows.
- Modify: `frontend/src/index.css`
  Responsibility: add only the teacher-management-specific layout classes that are missing from the shared workspace foundation.
- Create: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`
  Responsibility: assert workspace structure, core copy, and section ordering for the redesigned page.
- Reference: `frontend/src/components/workspace/WorkspacePageHeader.jsx`
- Reference: `frontend/src/components/workspace/WorkspaceMetricCard.jsx`
- Reference: `frontend/src/components/workspace/WorkspaceSectionCard.jsx`
- Reference: `docs/superpowers/specs/2026-04-01-teacher-management-workspace-design.md`

### Task 1: Add the failing workspace regression test

**Files:**
- Create: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`
- Test: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Write the failing test**

Create a source-based regression test modeled after the existing workspace content tests. Assert at minimum:
- `workspace-page`
- `WorkspacePageHeader`
- `WorkspaceMetricCard`
- `WorkspaceSectionCard`
- `教师管理工作台`
- `主流程工作区`
- `班级-科目-教师矩阵`
- `分配汇总`

Suggested test skeleton:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./TeacherClassManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /workspace-page/)
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceMetricCard/)
assert.match(source, /WorkspaceSectionCard/)
assert.ok(includesEither(String.raw`\u6559\u5e08\u7ba1\u7406\u5de5\u4f5c\u53f0`))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: FAIL because the current page still renders legacy `Card` sections and lacks workspace-specific copy and structure.

- [ ] **Step 3: Write minimal implementation**

Do not fully restyle yet. Add the minimum workspace imports and wrapper structure needed for the new test to start passing in later tasks.

- [ ] **Step 4: Run test to verify progress**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: still FAIL, but now only on the missing copy/section assertions rather than missing imports and shell structure.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs frontend/src/pages/TeacherClassManage.jsx
git commit -m "test: add teacher management workspace regression"
```

### Task 2: Convert the page shell and metrics to workspace layout

**Files:**
- Modify: `frontend/src/pages/TeacherClassManage.jsx`
- Test: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Extend the failing test**

Add assertions for the new summary layer:
- `教师总数`
- `已绑定班级`
- `已分配科目组`
- `待补齐项`

Also assert that the metric/header section appears before the matrix section by checking source order with `indexOf`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: FAIL because the header and metric-card content are not yet implemented.

- [ ] **Step 3: Write minimal implementation**

In `TeacherClassManage.jsx`:
- replace top-level `Space + Alert + Card` shell with `<div className="workspace-page">`
- import and use `WorkspacePageHeader`, `WorkspaceMetricCard`, `WorkspaceSectionCard`
- derive page metrics from existing data:
  - teacher count from `teachers.length`
  - bound-class count from unique `boundClassRows` and/or assignment-derived totals
  - assignment-group count from `groupedAssignments.length`
  - pending-item count from lightweight derived checks such as selected teacher gaps or unassigned teachers
- add concise header copy aligned with the approved spec

Suggested metric derivation shape:

```js
const metricItems = [
  { key: 'teachers', label: '教师总数', value: teachers.length, helper: '参与教师管理配置的账号数量' },
  { key: 'bound', label: '已绑定班级', value: totalBoundClassCount, helper: '已建立教师服务范围的班级关系' },
  { key: 'groups', label: '已分配科目组', value: groupedAssignments.length, helper: '按教师-科目聚合的授课分配组' },
  { key: 'pending', label: '待补齐项', value: pendingCount, helper: '仍需补齐班级绑定或科目分配的教师' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: PASS for header and metric assertions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TeacherClassManage.jsx frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs
git commit -m "feat: add teacher management workspace shell"
```

### Task 3: Rebuild the primary workflow area and current-teacher context

**Files:**
- Modify: `frontend/src/pages/TeacherClassManage.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Extend the failing test**

Add assertions for the workflow-oriented sections:
- `主流程工作区`
- `选择教师`
- `绑定班级`
- `分配科目`
- `当前教师概览`
- `待处理提醒`

Also assert that `主流程工作区` appears before `班级-科目-教师矩阵`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: FAIL because the workflow block and right-column context panel are not yet rendered.

- [ ] **Step 3: Write minimal implementation**

In `TeacherClassManage.jsx`:
- group teacher selection, class binding, and subject assignment into one main `WorkspaceSectionCard`
- add a right-column section for current-teacher context and reminders
- preserve existing handlers:
  - `handleTeacherChange`
  - `handleBindClass`
  - `handleAssign`
  - `handleUnbindClass`
- surface pre-submit warnings with inline `Alert` blocks when:
  - no teacher is selected
  - no classes are bound
  - selected classes imply limited subject options

In `index.css`, add compact layout rules such as:

```css
.teacher-manage-focus-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 20px;
}

.teacher-manage-flow-grid {
  display: grid;
  gap: 16px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: PASS for workflow and ordering assertions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TeacherClassManage.jsx frontend/src/index.css frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs
git commit -m "feat: reorganize teacher management workflow"
```

### Task 4: Convert matrix and summary into workspace result sections

**Files:**
- Modify: `frontend/src/pages/TeacherClassManage.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Extend the failing test**

Add assertions for:
- `矩阵总览` or matrix-summary copy chosen during implementation
- `班级-科目-教师矩阵`
- `分配汇总`
- `按教师-科目聚合`

Keep the test source-order assertion so the result sections remain below the primary workflow.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: FAIL because the lower result blocks still use legacy card titles and lack workspace section copy.

- [ ] **Step 3: Write minimal implementation**

In `TeacherClassManage.jsx`:
- wrap the matrix in a `WorkspaceSectionCard` with a short description and the existing grade filter in `extra`
- wrap the grouped summary table in another `WorkspaceSectionCard`
- keep the same table columns and destructive actions
- ensure the matrix remains the first result section and the grouped summary remains second

In `index.css`:
- add any needed responsive spacing and table-wrapper styles
- ensure narrow widths rely on horizontal table scroll rather than overflow

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TeacherClassManage.jsx frontend/src/index.css frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs
git commit -m "feat: restyle teacher management result sections"
```

### Task 5: Run focused verification

**Files:**
- Test: `frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`
- Test: `frontend/src/pages/TeacherClassManage.jsx`
- Test: `frontend/src/index.css`

- [ ] **Step 1: Run the workspace regression test**

Run: `node frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: PASS with `teacher manage workspace content checks passed`.

- [ ] **Step 2: Run the frontend build**

Run: `npm.cmd run build`

Expected: PASS with a successful Vite production build.

- [ ] **Step 3: Review the focused diff**

Run: `git diff -- frontend/src/pages/TeacherClassManage.jsx frontend/src/index.css frontend/src/pages/teacherClassManageWorkspaceContent.test.mjs`

Expected: only teacher-management workspace restructuring, styles, and the new regression test.

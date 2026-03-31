# Admin Workspace Unified Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the main admin-facing workspace so `MainLayout`, `Home`, `ClassManage`, `SubjectManage`, and `ExamManage` share the Schedule Manage visual language without changing existing APIs, routes, or role rules.

**Architecture:** Introduce a small shared “workspace shell” layer for page headers, metric cards, and section containers, then migrate each target page onto that shell one page at a time. Keep data fetching and CRUD behavior in the existing pages, add only front-end derived summaries and filters, and verify the redesign through lightweight Node content/syntax smoke tests plus a final production build.

**Tech Stack:** React 19, React Router, Ant Design 6, Vite, existing REST API modules in `frontend/src/api`, shared CSS in `frontend/src/index.css`, Node-based `.test.mjs` smoke/content checks

---

## Planned File Structure

**Shared shell**
- Create: `frontend/src/components/workspace/WorkspacePageHeader.jsx`
- Create: `frontend/src/components/workspace/WorkspaceMetricCard.jsx`
- Create: `frontend/src/components/workspace/WorkspaceSectionCard.jsx`
- Modify: `frontend/src/components/MainLayout.jsx`
- Modify: `frontend/src/index.css`

**Home workspace**
- Modify: `frontend/src/pages/Home.jsx`
- Create: `frontend/src/pages/homeWorkspaceContent.test.mjs`
- Modify: `frontend/src/pages/pageSyntaxSmoke.test.mjs`

**Management pages**
- Modify: `frontend/src/pages/ClassManage.jsx`
- Create: `frontend/src/pages/classManageWorkspaceContent.test.mjs`
- Modify: `frontend/src/pages/SubjectManage.jsx`
- Create: `frontend/src/pages/subjectManageWorkspaceContent.test.mjs`
- Modify: `frontend/src/pages/ExamManage.jsx`
- Create: `frontend/src/pages/examManageWorkspaceContent.test.mjs`

**Shell verification**
- Create: `frontend/src/components/mainLayoutWorkspaceShell.test.mjs`

**Reference docs**
- Reference: `docs/superpowers/specs/2026-03-31-admin-workspace-unified-redesign-design.md`

### Shared Component Responsibilities

- `frontend/src/components/workspace/WorkspacePageHeader.jsx`
  Renders the common top summary area with eyebrow, title, description, optional stats row, and primary actions.
- `frontend/src/components/workspace/WorkspaceMetricCard.jsx`
  Renders the compact metric cards reused across Home, ClassManage, SubjectManage, and ExamManage.
- `frontend/src/components/workspace/WorkspaceSectionCard.jsx`
  Wraps filter bars, tables, and secondary modules in one consistent card structure.
- `frontend/src/index.css`
  Hosts the reusable workbench tokens and responsive layout classes. Reuse the existing schedule page palette instead of introducing a second visual system.

### Shared Layout Rules To Preserve

- Keep the existing route tree in `frontend/src/App.jsx` unchanged.
- Keep API imports in the target pages unchanged unless a page already imports too much and a removal is clearly safe.
- Do not move CRUD logic into global state.
- Add only low-risk front-end helpers: filtering, derived counts, empty-state messaging, and quick-link presentation.

### Test Strategy To Preserve

- Follow the repo’s existing convention of lightweight Node content tests that read source files directly.
- Use `vite` syntax smoke checks for any page whose JSX structure changes heavily.
- Finish each major page task with `npm.cmd run build`.

---

### Task 1: Establish The Shared Workspace Shell

**Files:**
- Create: `frontend/src/components/workspace/WorkspacePageHeader.jsx`
- Create: `frontend/src/components/workspace/WorkspaceMetricCard.jsx`
- Create: `frontend/src/components/workspace/WorkspaceSectionCard.jsx`
- Create: `frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
- Modify: `frontend/src/components/MainLayout.jsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/mainLayoutWorkspaceShell.test.mjs` with checks like:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const layoutSource = await readFile(new URL('./MainLayout.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../index.css', import.meta.url), 'utf8')

assert.match(layoutSource, /workspace-shell/)
assert.match(layoutSource, /workspace-topbar/)
assert.match(cssSource, /\.workspace-shell/)
assert.match(cssSource, /\.workspace-page/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: FAIL because the new shared shell classes and structure do not exist yet

- [ ] **Step 3: Write minimal implementation**

Add the shared workspace layer:

```jsx
export function WorkspacePageHeader({ eyebrow, title, description, extra, children }) {
  return (
    <section className="workspace-page-header">
      <div className="workspace-page-header__main">
        <span className="workspace-page-header__eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {extra ? <div className="workspace-page-header__extra">{extra}</div> : null}
      {children ? <div className="workspace-page-header__metrics">{children}</div> : null}
    </section>
  )
}
```

Update `frontend/src/components/MainLayout.jsx` so the content area becomes:

```jsx
<Layout className="workspace-shell">
  <Sider className="workspace-sider" ... />
  <Layout className="workspace-main">
    <Header className="workspace-topbar">...</Header>
    <Content className="workspace-content-shell">
      <div className="workspace-content-inner">
        <Outlet />
      </div>
    </Content>
  </Layout>
</Layout>
```

Add the shared CSS tokens and responsive classes in `frontend/src/index.css`, reusing the existing schedule palette:

```css
.workspace-shell { min-height: 100vh; background: radial-gradient(...); }
.workspace-page { display: flex; flex-direction: column; gap: 18px; }
.workspace-page-header { border-radius: 28px; padding: 24px; ... }
.workspace-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.workspace-section-card { border-radius: 24px; ... }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: PASS

- [ ] **Step 5: Run build verification**

Run: `npm.cmd run build`
Expected: PASS with the new shared shell compiling successfully

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MainLayout.jsx frontend/src/components/workspace/WorkspacePageHeader.jsx frontend/src/components/workspace/WorkspaceMetricCard.jsx frontend/src/components/workspace/WorkspaceSectionCard.jsx frontend/src/components/mainLayoutWorkspaceShell.test.mjs frontend/src/index.css
git commit -m "feat: add shared admin workspace shell"
```

### Task 2: Rebuild Home Into A Role-Aware Workspace

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Create: `frontend/src/pages/homeWorkspaceContent.test.mjs`
- Modify: `frontend/src/pages/pageSyntaxSmoke.test.mjs`
- Reference: `frontend/src/pages/homeTeacherTimetablePermission.test.mjs`
- Reference: `frontend/src/pages/homeChineseContent.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/homeWorkspaceContent.test.mjs` with content checks for:

```js
assert.match(source, /workspace-page/)
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /\u5de5\u4f5c\u53f0/)
assert.match(source, /\u5feb\u6377\u5165\u53e3/)
assert.match(source, /\u8bfe\u8868\u603b\u89c8/)
assert.match(source, /user\?\.role === 'school_admin'/)
```

Update `frontend/src/pages/pageSyntaxSmoke.test.mjs` so it compiles `src/pages/Home.jsx`, `src/pages/ClassManage.jsx`, `src/pages/SubjectManage.jsx`, and `src/pages/ExamManage.jsx` instead of only `Home.jsx` and `ScoreManage.jsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/homeWorkspaceContent.test.mjs`
Expected: FAIL because the workspace header, quick entry section, and new structure are not present yet

- [ ] **Step 3: Keep existing guardrails green**

Run: `node frontend/src/pages/homeTeacherTimetablePermission.test.mjs`
Expected: PASS before refactor

Run: `node frontend/src/pages/homeChineseContent.test.mjs`
Expected: PASS before refactor

- [ ] **Step 4: Write minimal implementation**

Refactor `frontend/src/pages/Home.jsx` onto the shared shell:

```jsx
return (
  <div className="workspace-page">
    <WorkspacePageHeader
      eyebrow="Campus Workspace"
      title={heroTitle}
      description={heroDescription}
      extra={headerActions}
    >
      <div className="workspace-metric-grid">
        {summaryCards.map((item) => (
          <WorkspaceMetricCard key={item.key} {...item} />
        ))}
      </div>
    </WorkspacePageHeader>

    {isSchoolAdmin ? <WorkspaceSectionCard title="快捷入口">...</WorkspaceSectionCard> : null}
    <WorkspaceSectionCard title="课表总览">...</WorkspaceSectionCard>
    <WorkspaceSectionCard title="备忘录">...</WorkspaceSectionCard>
  </div>
)
```

Preserve:
- teacher/student timetable sections
- existing role branching
- memo CRUD
- period management and timetable fetching

Only add front-end derived summaries and consistent wrappers.

- [ ] **Step 5: Run focused tests**

Run: `node frontend/src/pages/homeWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/homeTeacherTimetablePermission.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/homeChineseContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 6: Run build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Home.jsx frontend/src/pages/homeWorkspaceContent.test.mjs frontend/src/pages/pageSyntaxSmoke.test.mjs
git commit -m "feat: redesign home workspace"
```

### Task 3: Rebuild Class Management On The Shared Pattern

**Files:**
- Modify: `frontend/src/pages/ClassManage.jsx`
- Create: `frontend/src/pages/classManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/classManageWorkspaceContent.test.mjs`:

```js
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /\u73ed\u7ea7\u603b\u6570/)
assert.match(source, /\u6309\u5e74\u7ea7\u7b5b\u9009/)
assert.match(source, /\u65b0\u5efa\u73ed\u7ea7/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/classManageWorkspaceContent.test.mjs`
Expected: FAIL because the page is still a plain button + table layout

- [ ] **Step 3: Write minimal implementation**

Refactor `frontend/src/pages/ClassManage.jsx` to add:

```jsx
const gradeOptions = [...new Set(data.map((item) => item.grade).filter(Boolean))]
const filteredRows = data.filter((item) => matchesGrade && matchesKeyword)
const metrics = [
  { label: '班级总数', value: data.length },
  { label: '年级覆盖', value: gradeOptions.length },
  { label: '筛选结果', value: filteredRows.length },
]
```

Render:
- shared page header
- metric card row
- filter bar with grade select and keyword input
- wrapped table card
- upgraded modal copy and action labels

Do not change:
- `getClasses`, `createClass`, `updateClass`, `deleteClass`
- modal submit logic
- row action semantics

- [ ] **Step 4: Run focused tests**

Run: `node frontend/src/pages/classManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 5: Run build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ClassManage.jsx frontend/src/pages/classManageWorkspaceContent.test.mjs
git commit -m "feat: redesign class management workspace"
```

### Task 4: Rebuild Subject Management With Summary And Filtering

**Files:**
- Modify: `frontend/src/pages/SubjectManage.jsx`
- Create: `frontend/src/pages/subjectManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/subjectManageWorkspaceContent.test.mjs`:

```js
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /\u79d1\u76ee\u603b\u6570/)
assert.match(source, /\u9002\u7528\u5e74\u7ea7/)
assert.match(source, /\u6309\u540d\u79f0\u6216\u4ee3\u7801\u641c\u7d22/)
assert.match(source, /\u672a\u5206\u914d\u9002\u7528\u5e74\u7ea7/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/subjectManageWorkspaceContent.test.mjs`
Expected: FAIL because the page lacks the workspace structure and summary copy

- [ ] **Step 3: Write minimal implementation**

Refactor `frontend/src/pages/SubjectManage.jsx` to add:

```jsx
const normalizedGrades = (record.grades ? record.grades.split(',') : []).filter(Boolean)
const uncoveredCount = data.filter((item) => !item.grades).length
const filteredRows = data.filter((item) => {
  const haystack = `${item.name} ${item.code}`.toLowerCase()
  return haystack.includes(keyword) && matchesGrade
})
```

Render:
- workspace header and metrics
- grade filter + keyword search
- wrapped table card with improved empty-state text
- softened warning tag when a subject has no grade coverage

Preserve:
- CSV string conversion for `grades`
- existing create/update/delete APIs

- [ ] **Step 4: Run focused tests**

Run: `node frontend/src/pages/subjectManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 5: Run build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SubjectManage.jsx frontend/src/pages/subjectManageWorkspaceContent.test.mjs
git commit -m "feat: redesign subject management workspace"
```

### Task 5: Rebuild Exam Management With Timeline-Oriented Hierarchy

**Files:**
- Modify: `frontend/src/pages/ExamManage.jsx`
- Create: `frontend/src/pages/examManageWorkspaceContent.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/examManageWorkspaceContent.test.mjs`:

```js
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /\u8003\u8bd5\u603b\u6570/)
assert.match(source, /\u6700\u8fd1\u4e00\u573a\u8003\u8bd5/)
assert.match(source, /\u6309\u53c2\u4e0e\u5e74\u7ea7\u8fc7\u6ee4/)
assert.match(source, /\u65b0\u5efa\u8003\u8bd5/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/examManageWorkspaceContent.test.mjs`
Expected: FAIL because the page is still a plain CRUD table

- [ ] **Step 3: Write minimal implementation**

Refactor `frontend/src/pages/ExamManage.jsx` to add:

```jsx
const sortedRows = [...data].sort((left, right) => dayjs(left.exam_date).valueOf() - dayjs(right.exam_date).valueOf())
const nextExam = sortedRows.find((item) => dayjs(item.exam_date).isAfter(dayjs().subtract(1, 'day')))
const gradeCoverage = new Set(data.flatMap((item) => (item.grade || '').split(',').filter(Boolean))).size
```

Render:
- shared workspace header
- metrics for total exams, nearest exam, grade coverage
- filter bar for keyword and grade
- wrapped table with stronger date emphasis
- improved empty state and modal copy

Preserve:
- `exam_date.format('YYYY-MM-DD')`
- grade array/string conversion logic
- existing CRUD APIs

- [ ] **Step 4: Run focused tests**

Run: `node frontend/src/pages/examManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 5: Run build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ExamManage.jsx frontend/src/pages/examManageWorkspaceContent.test.mjs
git commit -m "feat: redesign exam management workspace"
```

### Task 6: Final Integration Verification

**Files:**
- Verify: `frontend/src/components/MainLayout.jsx`
- Verify: `frontend/src/components/workspace/WorkspacePageHeader.jsx`
- Verify: `frontend/src/components/workspace/WorkspaceMetricCard.jsx`
- Verify: `frontend/src/components/workspace/WorkspaceSectionCard.jsx`
- Verify: `frontend/src/index.css`
- Verify: `frontend/src/pages/Home.jsx`
- Verify: `frontend/src/pages/ClassManage.jsx`
- Verify: `frontend/src/pages/SubjectManage.jsx`
- Verify: `frontend/src/pages/ExamManage.jsx`
- Verify: `frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
- Verify: `frontend/src/pages/homeWorkspaceContent.test.mjs`
- Verify: `frontend/src/pages/classManageWorkspaceContent.test.mjs`
- Verify: `frontend/src/pages/subjectManageWorkspaceContent.test.mjs`
- Verify: `frontend/src/pages/examManageWorkspaceContent.test.mjs`
- Verify: `frontend/src/pages/pageSyntaxSmoke.test.mjs`
- Verify: `frontend/src/pages/homeTeacherTimetablePermission.test.mjs`
- Verify: `frontend/src/pages/homeChineseContent.test.mjs`

- [ ] **Step 1: Run shell and page content tests**

Run: `node frontend/src/components/mainLayoutWorkspaceShell.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/homeWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/classManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/subjectManageWorkspaceContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/examManageWorkspaceContent.test.mjs`
Expected: PASS

- [ ] **Step 2: Run existing regression checks**

Run: `node frontend/src/pages/homeTeacherTimetablePermission.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/homeChineseContent.test.mjs`
Expected: PASS

Run: `node frontend/src/pages/pageSyntaxSmoke.test.mjs`
Expected: PASS

- [ ] **Step 3: Run production build verification**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Review UX regressions manually**

Check that:
- `MainLayout` still respects the current route tree and role-specific menus
- Home still shows teacher/student timetable boundaries correctly
- Class/Subject/Exam pages still submit their existing CRUD payloads
- all new filters only change front-end display, not server writes
- the shared shell stays readable on narrow screens

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-03-31-admin-workspace-unified-redesign.md
git commit -m "docs: add admin workspace redesign plan"
```

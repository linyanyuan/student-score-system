# ScheduleManage 重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改动后端排课协议的前提下，重写排课管理页，使学校管理员能够更高效地完成排课参数配置、保存、发起排课和查看当前草案闭环。

**Architecture:** 前端保持现有 `MainLayout`、路由和排课 API 封装体系不变，重写 [`frontend/src/pages/ScheduleManage.jsx`](d:/project/student-score-system/frontend/src/pages/ScheduleManage.jsx) 为“总控条 + 总览卡片 + 配置标签页 + 草案闭环”的 Ant Design 工作台。页面内部把接口原始值与编辑态分离，复杂转换提取到独立工具模块并用 Node 直跑测试覆盖。

**Tech Stack:** React 19, Ant Design, Axios, Vite, Node.js

---

## File Structure Map

- `frontend/src/pages/ScheduleManage.jsx`: 主页面，负责数据加载、编辑态、保存、排课任务轮询、草案查看和正式课表预览。
- `frontend/src/pages/scheduleManageUtils.js`: 提取页面使用的纯函数，包括年级排序、禁排时段解析与格式化、总览统计、草案明细到课表行转换。
- `frontend/src/pages/scheduleManageUtils.test.mjs`: 使用 Node `assert` 的轻量测试，验证关键纯函数。
- `frontend/src/api/scheduling.js`: 只做必要的前端兼容性修正，保持现有接口协议不变。
- `docs/superpowers/specs/2026-03-31-schedule-manage-rewrite-design.md`: 已确认设计稿，实现时需持续对照。

Known limitation:
- 当前后端没有“按年级列出草案历史”的接口，页面草案区以“当前任务返回的 `draft_id` 对应草案”为主；页面刷新后若没有本地当前任务上下文，草案区显示空状态而不是伪造历史列表。

Execution discipline:
- Follow `superpowers:test-driven-development` per implementation task.
- Before claiming implementation complete, run `superpowers:verification-before-completion`.

### Task 1: 建立排课页纯函数与回归测试基线

**Files:**
- Create: `frontend/src/pages/scheduleManageUtils.js`
- Create: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: 写失败测试，先固定禁排时段解析、格式化和课表行转换行为**

```javascript
import assert from 'node:assert/strict'
import {
  buildTimetableRows,
  formatForbiddenPeriods,
  parseForbiddenPeriods,
} from './scheduleManageUtils.js'

assert.deepEqual(parseForbiddenPeriods('1-1, 5-3'), [[1, 1], [5, 3]])
assert.equal(formatForbiddenPeriods([[2, 4], [3, 1]]), '2-4,3-1')
assert.deepEqual(
  buildTimetableRows([
    { weekday: 1, period_id: 1, subject_name: '数学', teacher_name: '张老师' },
  ]),
  [
    { key: '1', period_id: 1, periodLabel: '第1节', day_1: '数学 / 张老师', day_2: '', day_3: '', day_4: '', day_5: '' },
  ],
)
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL with module not found or missing export

- [ ] **Step 3: 实现最小工具函数**

```javascript
export function parseForbiddenPeriods(text) {
  if (!text || !text.trim()) return []
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [weekday, periodId] = item.split('-').map(Number)
      return Number.isInteger(weekday) && Number.isInteger(periodId) ? [weekday, periodId] : null
    })
    .filter(Boolean)
}
```

- [ ] **Step 4: 补齐格式化、统计和表格数据转换函数**

```javascript
export function buildSummaryCounts({ plans, arrangements, teacherConstraints, locks }) {
  return {
    plans: plans.length,
    arrangements: arrangements.length,
    teacherConstraints: teacherConstraints.length,
    locks: locks.length,
  }
}
```

- [ ] **Step 5: 运行测试，确认工具函数全部通过**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "test: add schedule manage utility regression coverage"
```

### Task 2: 重写页面骨架与配置编辑工作台

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Create: `frontend/src/pages/scheduleManageUtils.js`
- Test: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: 写失败测试，先固定总览统计与缺项诊断逻辑**

```javascript
import assert from 'node:assert/strict'
import { buildConfigWarnings, buildSummaryCounts } from './scheduleManageUtils.js'

assert.deepEqual(buildSummaryCounts({ plans: [1], arrangements: [], teacherConstraints: [], locks: [] }), {
  plans: 1,
  arrangements: 0,
  teacherConstraints: 0,
  locks: 0,
})
assert.deepEqual(buildConfigWarnings({ plans: [], arrangements: [], teacherConstraints: [], locks: [] }), [
  '尚未配置课时计划',
  '尚未配置任课安排',
])
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL with missing helper export

- [ ] **Step 3: 在工具模块中补齐总览告警函数**

```javascript
export function buildConfigWarnings({ plans, arrangements }) {
  const warnings = []
  if (!plans.length) warnings.push('尚未配置课时计划')
  if (!arrangements.length) warnings.push('尚未配置任课安排')
  return warnings
}
```

- [ ] **Step 4: 重写 `ScheduleManage.jsx` 页面骨架**

实现目标：
- 顶部工具条包含年级、刷新、保存全部、开始排课
- 下方总览卡片显示 4 项统计
- 主体使用 `Tabs` 分为“配置总览 / 课时计划 / 任课安排 / 教师约束 / 锁定课时 / 排课草案”
- 所有配置模块使用 Ant Design `Table` + 行内输入控件

```jsx
<Tabs
  activeKey={activeTab}
  onChange={setActiveTab}
  items={[
    { key: 'overview', label: '配置总览', children: <OverviewPanel /> },
    { key: 'plans', label: '课时计划', children: <LessonPlanTable /> },
  ]}
/>
```

- [ ] **Step 5: 运行轻量语法校验与工具测试**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "feat: rebuild schedule manage configuration workspace"
```

### Task 3: 接通数据加载、保存全部与未保存状态

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/api/scheduling.js`
- Test: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: 写失败测试，固定年级排序和空值过滤逻辑**

```javascript
import assert from 'node:assert/strict'
import { buildGradeOptions } from './scheduleManageUtils.js'

assert.deepEqual(
  buildGradeOptions([{ grade: '高二' }, { grade: '高一' }, { grade: '高一' }]).map((item) => item.value),
  ['高一', '高二'],
)
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL with missing `buildGradeOptions`

- [ ] **Step 3: 在工具模块中实现年级排序函数**

```javascript
export function buildGradeOptions(classes) {
  const seen = new Set()
  return classes
    .map((item) => item.grade)
    .filter((grade) => grade && !seen.has(grade) && seen.add(grade))
    .sort(compareGrade)
    .map((grade) => ({ label: grade, value: grade }))
}
```

- [ ] **Step 4: 接通页面的加载与保存流程**

实现目标：
- 初始化并行加载班级、科目、教师
- 年级切换后并行加载 5 组配置
- 使用单个 `handleSaveAll` 统一提交 5 组保存接口
- 编辑任一配置后设置 `dirty` 标记，保存成功后清除
- 若 `frontend/src/api/scheduling.js` 有误导性方法命名，仅做最小兼容修正，不新增后端协议

```javascript
await Promise.all([
  saveLessonPlan({ grade, items: planPayload }),
  saveTeachingArrangement({ grade, items: arrangements }),
  saveLessonPlanOverrides({ grade, items: overrides }),
  saveTeacherConstraints({ grade, items: teacherConstraints }),
  saveTimetableLocks({ grade, items: locks }),
])
```

- [ ] **Step 5: 运行工具测试并执行前端构建**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

Run: `npm.cmd run build`
Expected: Build succeeds without `ScheduleManage.jsx` syntax errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx frontend/src/api/scheduling.js frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "feat: connect schedule manage data loading and save flow"
```

### Task 4: 接通排课任务轮询、当前草案闭环与正式课表预览

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/pages/scheduleManageUtils.js`
- Test: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: 写失败测试，固定任务结果到草案展示状态的映射**

```javascript
import assert from 'node:assert/strict'
import { getDraftIdFromTaskResult, getTaskStatusTone } from './scheduleManageUtils.js'

assert.equal(getDraftIdFromTaskResult({ draft_id: 12, score: 96 }), 12)
assert.equal(getTaskStatusTone('success'), 'success')
assert.equal(getTaskStatusTone('failed'), 'error')
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL with missing helper export

- [ ] **Step 3: 在工具模块中实现任务/草案映射帮助函数**

```javascript
export function getDraftIdFromTaskResult(result) {
  return Number.isInteger(result?.draft_id) ? result.draft_id : null
}
```

- [ ] **Step 4: 实现排课任务与草案闭环**

实现目标：
- “开始排课”调用现有任务接口并轮询任务状态
- 成功后从任务结果提取 `draft_id`，再请求草案头和草案明细
- 自动切换到“排课草案”标签页
- 支持发布当前草案
- 支持按班级预览正式课表
- 若页面重载后没有当前 `draft_id`，草案区显示空状态说明，而不是伪造历史列表

```javascript
const taskResp = await createAutoScheduleTask(grade)
const taskId = taskResp.data?.task_id
const nextDraftId = getDraftIdFromTaskResult(taskData.result)
if (nextDraftId) {
  const [draftResp, itemsResp] = await Promise.all([
    getScheduleDraft(nextDraftId),
    getScheduleDraftItems(nextDraftId),
  ])
}
```

- [ ] **Step 5: 运行工具测试与构建验证**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

Run: `npm.cmd run build`
Expected: Build succeeds and the rewritten page compiles

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "feat: add schedule solve polling and draft workflow"
```

### Task 5: 完成视觉打磨与人工验收

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Modify: `frontend/src/pages/scheduleManageUtils.js`
- Test: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: 写失败测试，固定总览卡片文案或空状态文案生成逻辑**

```javascript
import assert from 'node:assert/strict'
import { buildDraftEmptyStateMessage } from './scheduleManageUtils.js'

assert.equal(buildDraftEmptyStateMessage(null), '当前还没有草案，保存配置后可开始排课。')
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: FAIL with missing helper export

- [ ] **Step 3: 补齐空状态和状态文案帮助函数**

```javascript
export function buildDraftEmptyStateMessage(draftId) {
  return draftId ? '当前草案明细为空。' : '当前还没有草案，保存配置后可开始排课。'
}
```

- [ ] **Step 4: 完成页面打磨并做手动验收**

手动验收清单：
1. school_admin 进入 `/schedule-manage` 时页面可正常渲染。
2. 选择不同年级会刷新配置。
3. 修改课时计划、任课安排、教师约束、锁定课时后出现未保存提示。
4. 点击“保存全部”后提示成功，未保存提示消失。
5. 点击“开始排课”后进入轮询态，并自动切到草案区。
6. 草案成功时可看到得分、摘要和明细。
7. 草案发布后有成功反馈。
8. 选择班级后可预览正式课表。

- [ ] **Step 5: 运行最终验证**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ScheduleManage.jsx frontend/src/pages/scheduleManageUtils.js frontend/src/pages/scheduleManageUtils.test.mjs
git commit -m "refactor: polish rewritten schedule manage page"
```

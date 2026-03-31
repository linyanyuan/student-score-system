import assert from 'node:assert/strict'

import {
  buildConfigWarnings,
  buildSummaryCounts,
  buildTaskSnapshot,
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
    {
      key: '1',
      period_id: 1,
      periodLabel: '第1节',
      day_1: '数学 / 张老师',
      day_2: '',
      day_3: '',
      day_4: '',
      day_5: '',
    },
  ],
)

assert.deepEqual(
  buildSummaryCounts({
    plans: [{ subject_id: undefined }, { subject_id: 2 }],
    arrangements: [{ class_id: 1, subject_id: 2, teacher_id: 3 }, { class_id: undefined }],
    overrides: [{ class_id: undefined, subject_id: undefined }, { class_id: 1, subject_id: 2 }],
    teacherConstraints: [{ teacher_id: undefined }, { teacher_id: 8 }],
    locks: [{ class_id: undefined }, { class_id: 1, subject_id: 2, teacher_id: 3, period_id: 4 }],
  }),
  {
    plans: 1,
    arrangements: 1,
    overrides: 1,
    teacherConstraints: 1,
    locks: 1,
  },
)

assert.deepEqual(
  buildConfigWarnings({
    plans: [{ subject_id: undefined }],
    arrangements: [{ class_id: undefined, subject_id: undefined, teacher_id: undefined }],
    dirty: true,
  }),
  ['尚未配置课时计划', '尚未配置任课安排', '当前修改尚未保存'],
)

assert.deepEqual(
  buildTaskSnapshot({
    task: null,
    currentDraft: null,
    draftItems: [],
  }),
  {
    tone: 'idle',
    title: '尚未生成当前草案',
    description: '保存配置后即可发起自动排课。',
    progress: 0,
    readyToPublish: false,
  },
)

assert.deepEqual(
  buildTaskSnapshot({
    task: { status: 'pending', progress: 32, message: '正在计算冲突' },
    currentDraft: null,
    draftItems: [],
  }),
  {
    tone: 'processing',
    title: '排课引擎正在生成当前草案',
    description: '正在计算冲突',
    progress: 32,
    readyToPublish: false,
  },
)

assert.deepEqual(
  buildTaskSnapshot({
    task: { status: 'success', progress: 100 },
    currentDraft: {
      score: 96,
      summary: {
        locked_hits: 8,
        locked_total: 8,
        risk_count: 1,
      },
    },
    draftItems: [{}, {}, {}],
  }),
  {
    tone: 'success',
    title: '当前草案已生成',
    description: '得分 96，锁定命中 8/8，风险 1，草案课位 3 条。',
    progress: 100,
    readyToPublish: true,
  },
)

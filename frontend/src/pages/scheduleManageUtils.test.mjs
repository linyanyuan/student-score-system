import assert from 'node:assert/strict'

import {
  buildConfigWarnings,
  buildSummaryCounts,
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
  buildSummaryCounts({ plans: [1], arrangements: [], teacherConstraints: [], locks: [] }),
  {
    plans: 1,
    arrangements: 0,
    teacherConstraints: 0,
    locks: 0,
  },
)

assert.deepEqual(
  buildConfigWarnings({ plans: [], arrangements: [], teacherConstraints: [], locks: [] }),
  ['尚未配置课时计划', '尚未配置任课安排'],
)

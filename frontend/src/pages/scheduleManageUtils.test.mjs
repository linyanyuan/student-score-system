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

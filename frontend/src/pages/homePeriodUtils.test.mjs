import assert from 'node:assert/strict';

import { buildSchedulePeriodPayload, buildTimetableRows, isCreatingPeriod } from './homePeriodUtils.js';

assert.equal(isCreatingPeriod(null), true);
assert.equal(isCreatingPeriod(undefined), true);
assert.equal(isCreatingPeriod({ id: 1, name: '第一节' }), false);

const mockTime = (value) => ({ format: () => value });

const defaultPayload = buildSchedulePeriodPayload({
  name: '早自习',
  start_time: mockTime('07:10'),
  end_time: mockTime('07:50'),
  sort_order: 3,
});

assert.deepEqual(defaultPayload, {
  name: '早自习',
  start_time: '07:10',
  end_time: '07:50',
  sort_order: 3,
  include_in_auto_schedule: true,
});

const excludedPayload = buildSchedulePeriodPayload({
  name: '午休',
  start_time: mockTime('12:30'),
  end_time: mockTime('13:30'),
  include_in_auto_schedule: false,
});

assert.deepEqual(excludedPayload, {
  name: '午休',
  start_time: '12:30',
  end_time: '13:30',
  sort_order: 1,
  include_in_auto_schedule: false,
});

const timetableRows = buildTimetableRows(
  [
    {
      weekday: 1,
      period_id: 2,
      period_name: '第一节',
      subject_name: '数学',
      teacher_name: 'linyan',
    },
    {
      weekday: 2,
      period_id: 31,
      period_name: '第2节',
      subject_name: '语文',
      teacher_name: 'xiaofang',
    },
  ],
  [
    { id: 30, name: '第1节', start_time: '08:10', end_time: '08:55' },
    { id: 31, name: '第2节', start_time: '09:05', end_time: '09:50' },
  ],
);

assert.equal(timetableRows[0].day1.subject_name, '数学');
assert.equal(timetableRows[1].day2.subject_name, '语文');

console.log('homePeriodUtils checks passed');

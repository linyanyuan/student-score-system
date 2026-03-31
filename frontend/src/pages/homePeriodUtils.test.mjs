import assert from 'node:assert/strict';

import { buildSchedulePeriodPayload, isCreatingPeriod } from './homePeriodUtils.js';

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

console.log('homePeriodUtils checks passed');

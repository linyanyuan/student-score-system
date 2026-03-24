import assert from 'node:assert/strict';

import { buildSchedulePeriodPayload, isCreatingPeriod } from './homePeriodUtils.js';

assert.equal(isCreatingPeriod(null), true);
assert.equal(isCreatingPeriod(undefined), true);

assert.equal(isCreatingPeriod({ id: 1, name: '第一节' }), false);

const mockTime = (value) => ({ format: () => value });
const payload = buildSchedulePeriodPayload({
  name: '早自习',
  start_time: mockTime('07:10'),
  end_time: mockTime('07:50'),
  sort_order: 3,
});

assert.deepEqual(payload, {
  name: '早自习',
  start_time: '07:10',
  end_time: '07:50',
  sort_order: 3,
});

console.log('homePeriodUtils checks passed');

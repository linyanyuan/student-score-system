import assert from "node:assert/strict";

import { buildSchedulePeriodPayload, isCreatingFirstPeriod } from "../src/pages/homePeriodUtils.js";

assert.equal(isCreatingFirstPeriod([], null), true);
assert.equal(isCreatingFirstPeriod([{ id: 1 }], null), false);
assert.equal(isCreatingFirstPeriod([], { id: 1 }), false);

const payload = buildSchedulePeriodPayload({
  name: "Period 1",
  start_time: { format: () => "08:00" },
  end_time: { format: () => "08:45" },
  sort_order: 1,
});

assert.deepEqual(payload, {
  name: "Period 1",
  start_time: "08:00",
  end_time: "08:45",
  sort_order: 1,
});

console.log("homePeriodUtils ok");

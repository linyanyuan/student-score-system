export const isCreatingFirstPeriod = (periods, editingPeriod) => periods.length === 0 && !editingPeriod;

export const buildSchedulePeriodPayload = (values) => ({
  name: values.name,
  start_time: values.start_time.format('HH:mm'),
  end_time: values.end_time.format('HH:mm'),
  sort_order: values.sort_order ?? 1,
});

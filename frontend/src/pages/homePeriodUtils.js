export const isCreatingPeriod = (editingPeriod) => !editingPeriod;

export const buildSchedulePeriodPayload = (values) => ({
  name: values.name,
  start_time: values.start_time.format('HH:mm'),
  end_time: values.end_time.format('HH:mm'),
  sort_order: values.sort_order ?? 1,
  include_in_auto_schedule: values.include_in_auto_schedule !== false,
});

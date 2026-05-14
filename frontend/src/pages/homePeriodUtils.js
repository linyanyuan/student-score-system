export const isCreatingPeriod = (editingPeriod) => !editingPeriod;

export const buildSchedulePeriodPayload = (values) => ({
  name: values.name,
  start_time: values.start_time.format('HH:mm'),
  end_time: values.end_time.format('HH:mm'),
  sort_order: values.sort_order ?? 1,
  include_in_auto_schedule: values.include_in_auto_schedule !== false,
});

const CHINESE_DIGITS = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseChineseNumber(value) {
  if (!value) return null;
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [left, right] = value.split('十');
    const tens = left ? CHINESE_DIGITS[left] : 1;
    const ones = right ? CHINESE_DIGITS[right] : 0;
    return tens && ones !== undefined ? tens * 10 + ones : null;
  }
  return CHINESE_DIGITS[value] || null;
}

function periodKey(name) {
  const text = String(name || '').replace(/\s+/g, '');
  const digitMatch = text.match(/第?(\d+)节/);
  if (digitMatch) return `lesson-${Number(digitMatch[1])}`;
  const chineseMatch = text.match(/第?([一二三四五六七八九十]+)节/);
  if (chineseMatch) {
    const parsed = parseChineseNumber(chineseMatch[1]);
    if (parsed) return `lesson-${parsed}`;
  }
  return text;
}

export function buildTimetableRows(items = [], periods = []) {
  const periodList = periods.length > 0
    ? periods
    : Array.from(new Set(items.map((item) => item.period_id))).sort((a, b) => a - b)
      .map((id) => {
        const item = items.find((entry) => entry.period_id === id);
        return { id, name: item?.period_name || `第${id}节`, start_time: '', end_time: '' };
      });

  return periodList.map((period) => {
    const row = {
      key: String(period.id),
      period: period.name,
      time: period.start_time && period.end_time ? `${period.start_time}-${period.end_time}` : '',
    };
    const currentPeriodKey = periodKey(period.name);
    for (let day = 1; day <= 5; day += 1) {
      row[`day${day}`] =
        items.find((item) => item.period_id === period.id && item.weekday === day) ||
        items.find((item) => item.weekday === day && periodKey(item.period_name) === currentPeriodKey) ||
        null;
    }
    return row;
  });
}

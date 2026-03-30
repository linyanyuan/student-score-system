export function parseForbiddenPeriods(text) {
  if (!text || !text.trim()) {
    return []
  }

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [weekday, periodId] = item.split('-').map(Number)
      if (!Number.isInteger(weekday) || !Number.isInteger(periodId)) {
        return null
      }
      return [weekday, periodId]
    })
    .filter(Boolean)
}

export function formatForbiddenPeriods(periods) {
  if (!Array.isArray(periods) || !periods.length) {
    return ''
  }

  return periods
    .filter((item) => Array.isArray(item) && item.length === 2)
    .map(([weekday, periodId]) => `${weekday}-${periodId}`)
    .join(',')
}

export function buildTimetableRows(items) {
  const periodIds = [...new Set((items || []).map((item) => item.period_id))].sort((left, right) => left - right)

  return periodIds.map((periodId) => {
    const row = {
      key: String(periodId),
      period_id: periodId,
      periodLabel: `第${periodId}节`,
      day_1: '',
      day_2: '',
      day_3: '',
      day_4: '',
      day_5: '',
    }

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const item = (items || []).find((entry) => entry.period_id === periodId && entry.weekday === weekday)
      row[`day_${weekday}`] = item ? `${item.subject_name || '-'} / ${item.teacher_name || '-'}` : ''
    }

    return row
  })
}

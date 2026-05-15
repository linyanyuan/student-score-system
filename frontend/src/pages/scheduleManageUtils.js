const WEEKDAY_COUNT = 5
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
}

function parseChineseNumber(value) {
  if (!value) return null
  if (value === '十') return 10
  if (value.includes('十')) {
    const [left, right] = value.split('十')
    const tens = left ? CHINESE_DIGITS[left] : 1
    const ones = right ? CHINESE_DIGITS[right] : 0
    return tens && ones !== undefined ? tens * 10 + ones : null
  }
  return CHINESE_DIGITS[value] || null
}

function periodKey(name) {
  const text = String(name || '').replace(/\s+/g, '')
  const digitMatch = text.match(/第?(\d+)节/)
  if (digitMatch) return `lesson-${Number(digitMatch[1])}`
  const chineseMatch = text.match(/第?([一二三四五六七八九十]+)节/)
  if (chineseMatch) {
    const parsed = parseChineseNumber(chineseMatch[1])
    if (parsed) return `lesson-${parsed}`
  }
  return text
}

function countFilledRows(items, predicate) {
  return (items || []).filter((item) => predicate(item || {})).length
}

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

export function buildTimetableRows(items = [], periods = []) {
  const periodList = periods.length > 0
    ? periods
    : [...new Set(items.map((item) => item.period_id).filter(Number.isFinite))]
      .sort((left, right) => left - right)
      .map((periodId) => {
        const matchedItem = items.find((item) => item.period_id === periodId)
        return {
          id: periodId,
          name: matchedItem?.period_name || `第${periodId}节`,
        }
      })

  return periodList.map((period) => {
    const periodId = period.id
    const periodLabel = period.name || `第${periodId}节`
    const currentPeriodKey = periodKey(periodLabel)
    const row = {
      key: String(periodId),
      period_id: periodId,
      periodLabel,
      day_1: '',
      day_2: '',
      day_3: '',
      day_4: '',
      day_5: '',
    }

    for (let weekday = 1; weekday <= WEEKDAY_COUNT; weekday += 1) {
      const item = items.find((entry) => entry.period_id === periodId && entry.weekday === weekday)
        || items.find((entry) => entry.weekday === weekday && periodKey(entry.period_name) === currentPeriodKey)
      row[`day_${weekday}`] = item ? `${item.subject_name || '-'} / ${item.teacher_name || '-'}` : ''
    }

    return row
  })
}

export function buildSummaryCounts({ plans = [], arrangements = [], overrides = [], teacherConstraints = [], locks = [] }) {
  return {
    plans: countFilledRows(plans, (item) => Boolean(item.subject_id)),
    arrangements: countFilledRows(arrangements, (item) => Boolean(item.class_id && item.subject_id && item.teacher_id)),
    overrides: countFilledRows(overrides, (item) => Boolean(item.class_id && item.subject_id)),
    teacherConstraints: countFilledRows(teacherConstraints, (item) => Boolean(item.teacher_id)),
    locks: countFilledRows(locks, (item) => Boolean(item.class_id && item.subject_id && item.teacher_id && item.period_id)),
  }
}

export function findArrangementSubjectsMissingPlans({ plans = [], arrangements = [], subjects = [] }) {
  const plannedSubjectIds = new Set(
    (plans || [])
      .map((item) => Number(item?.subject_id || 0))
      .filter(Boolean),
  )
  const subjectNameMap = new Map((subjects || []).map((item) => [Number(item.id), item.name]))
  const missingSubjectIds = [
    ...new Set(
      (arrangements || [])
        .filter((item) => item?.class_id && item?.subject_id && item?.teacher_id)
        .map((item) => Number(item.subject_id || 0))
        .filter((subjectId) => subjectId && !plannedSubjectIds.has(subjectId)),
    ),
  ]

  return missingSubjectIds.map((subjectId) => ({
    subject_id: subjectId,
    subject_name: subjectNameMap.get(subjectId) || `科目 ${subjectId}`,
  }))
}

export function buildConfigWarnings({ plans = [], arrangements = [], subjects = [], dirty = false }) {
  const warnings = []
  const summaryCounts = buildSummaryCounts({ plans, arrangements })

  if (!summaryCounts.plans) {
    warnings.push('尚未配置课时计划')
  }

  if (!summaryCounts.arrangements) {
    warnings.push('尚未配置任课安排')
  }

  const missingPlanSubjects = findArrangementSubjectsMissingPlans({ plans, arrangements, subjects })
  if (missingPlanSubjects.length) {
    const names = missingPlanSubjects.map((item) => item.subject_name).join('、')
    warnings.push(`有 ${missingPlanSubjects.length} 门任课科目未配置课时规则，本次不会自动排课：${names}`)
  }

  if (dirty) {
    warnings.push('当前修改尚未保存')
  }

  return warnings
}

export function buildTaskSnapshot({ task, currentDraft, draftItems = [] }) {
  if (task?.status === 'failed') {
    return {
      tone: 'danger',
      title: '排课任务失败',
      description: task.error || task.message || '请检查排课配置后重试。',
      progress: Number(task.progress || 100),
      readyToPublish: false,
    }
  }

  if (task && !['success', 'failed'].includes(task.status)) {
    return {
      tone: 'processing',
      title: '排课引擎正在生成当前草案',
      description: task.message || '系统正在计算冲突与可行解。',
      progress: Number(task.progress || 0),
      readyToPublish: false,
    }
  }

  if (currentDraft) {
    const lockedHits = currentDraft.summary?.locked_hits ?? 0
    const lockedTotal = currentDraft.summary?.locked_total ?? 0
    const riskCount = currentDraft.summary?.risk_count ?? 0

    return {
      tone: 'success',
      title: '当前草案已生成',
      description: `得分 ${currentDraft.score ?? 0}，锁定命中 ${lockedHits}/${lockedTotal}，风险 ${riskCount}，草案课位 ${draftItems.length} 条。`,
      progress: 100,
      readyToPublish: true,
    }
  }

  return {
    tone: 'idle',
    title: '尚未生成当前草案',
    description: '保存配置后即可发起自动排课。',
    progress: 0,
    readyToPublish: false,
  }
}

export function summarizeImportIssues(items = []) {
  return (items || []).reduce(
    (summary, item) => {
      const flags = Array.isArray(item?.issue_flags) ? item.issue_flags : []
      summary.total += 1
      if (flags.length) summary.unresolved += 1
      if (flags.includes('unrecognized_subject')) summary.unrecognizedSubject += 1
      if (flags.includes('teacher_unmatched')) summary.teacherUnmatched += 1
      if (flags.includes('teacher_ambiguous') || item?.teacher_match_status === 'ambiguous') summary.teacherAmbiguous += 1
      if (flags.includes('teacher_time_conflict')) summary.teacherTimeConflict += 1
      return summary
    },
    {
      total: 0,
      unresolved: 0,
      unrecognizedSubject: 0,
      teacherUnmatched: 0,
      teacherAmbiguous: 0,
      teacherTimeConflict: 0,
    },
  )
}

export function canCreateImportDraft(items = []) {
  return summarizeImportIssues(items).unresolved === 0
}

export function filterImportItemsByStatus(items = [], status = 'all') {
  if (status === 'all') return items || []
  return (items || []).filter((item) => {
    const flags = Array.isArray(item?.issue_flags) ? item.issue_flags : []
    if (status === 'unresolved') return flags.length > 0
    if (status === 'matched') return flags.length === 0
    if (status === 'teacher_ambiguous') return flags.includes('teacher_ambiguous') || item?.teacher_match_status === 'ambiguous'
    return flags.includes(status)
  })
}

const WEEKDAY_COUNT = 5

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

export function buildTimetableRows(items) {
  const periodIds = [...new Set((items || []).map((item) => item.period_id).filter(Number.isFinite))].sort((left, right) => left - right)

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

    for (let weekday = 1; weekday <= WEEKDAY_COUNT; weekday += 1) {
      const item = (items || []).find((entry) => entry.period_id === periodId && entry.weekday === weekday)
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

export function buildConfigWarnings({ plans = [], arrangements = [], dirty = false }) {
  const warnings = []
  const summaryCounts = buildSummaryCounts({ plans, arrangements })

  if (!summaryCounts.plans) {
    warnings.push('尚未配置课时计划')
  }

  if (!summaryCounts.arrangements) {
    warnings.push('尚未配置任课安排')
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

const SUBJECT_NAME = {
  chinese: '语文',
  chineseShort: '语',
  math: '数学',
  mathShort: '数',
  english: '英语',
  englishShort: '英',
}

const DEFAULT_SUBJECT_FULL_SCORES = {
  chinese: 120,
  math: 120,
  english: 120,
  other: 60,
}

const COMPARISON_SERIES = [
  ['当前学生', 'student_score'],
  ['班级均分', 'class_avg'],
  ['年级均分', 'grade_avg'],
  ['最高分', 'highest_score'],
]

export const inferSubjectFullScore = (subjectName) => {
  const normalized = String(subjectName || '').trim()
  if (normalized === SUBJECT_NAME.chinese || normalized === SUBJECT_NAME.chineseShort) return DEFAULT_SUBJECT_FULL_SCORES.chinese
  if (normalized === SUBJECT_NAME.math || normalized === SUBJECT_NAME.mathShort) return DEFAULT_SUBJECT_FULL_SCORES.math
  if (normalized === SUBJECT_NAME.english || normalized === SUBJECT_NAME.englishShort) return DEFAULT_SUBJECT_FULL_SCORES.english
  return DEFAULT_SUBJECT_FULL_SCORES.other
}

export const resolveSubjectFullScore = (subjectName, rawFullScore) => {
  const parsed = Number(rawFullScore)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return inferSubjectFullScore(subjectName)
}

export const normalizeScoreToFullScore = (score, fullScore) => {
  const s = Number(score)
  const f = Number(fullScore)
  if (!Number.isFinite(s) || !Number.isFinite(f) || f <= 0) return 0
  const ratio = (s / f) * 100
  if (ratio < 0) return 0
  if (ratio > 100) return 100
  return Number(ratio.toFixed(2))
}

export const buildRadarSubjectPoints = (subjectComparison = []) =>
  subjectComparison.map((row, index) => {
    const subject = String(row?.subject_name || '').trim() || `科目${index + 1}`
    const fullScore = resolveSubjectFullScore(subject, row?.subject_full_score)
    const studentScore = Number(row?.student_score)
    const normalizedStudentScore = Number.isFinite(studentScore) ? studentScore : 0
    return {
      subject,
      student_score: normalizedStudentScore,
      full_score: fullScore,
      score_rate: normalizeScoreToFullScore(normalizedStudentScore, fullScore),
    }
  })

export const buildTotalScoreComparisonBars = (comparisonRows = []) => {
  const totalRow = comparisonRows.find((row) => String(row?.dimension_name || '').trim() === '总分')
  if (!totalRow) return []

  return COMPARISON_SERIES
    .map(([label, field]) => ({ label, score: Number(totalRow?.[field]) }))
    .filter((item) => Number.isFinite(item.score))
}

export const buildSubjectScoreComparisonLineSeries = (comparisonRows = []) =>
  comparisonRows
    .filter((row) => String(row?.dimension_name || '').trim() && String(row?.dimension_name || '').trim() !== '总分')
    .flatMap((row) =>
      COMPARISON_SERIES
        .map(([series, field]) => ({
          dimension: String(row.dimension_name).trim(),
          series,
          score: Number(row?.[field]),
        }))
        .filter((item) => Number.isFinite(item.score))
    )

export const buildRankChartRowsWithGradeAverage = (rows = []) => {
  const normalizedRows = rows.map((row) => ({
    ...row,
    item_type: row?.item_type || 'class',
  }))
  const gradeAverageRows = []
  const seenGrades = new Set()

  normalizedRows.forEach((row) => {
    const grade = String(row?.grade || '').trim()
    const gradeAvg = Number(row?.grade_avg)
    if (!grade || !Number.isFinite(gradeAvg) || seenGrades.has(grade)) {
      return
    }
    seenGrades.add(grade)
    gradeAverageRows.push({
      class_name: `${grade}均分`,
      avg_score: gradeAvg,
      grade_avg: gradeAvg,
      grade,
      item_type: 'grade_avg',
    })
  })

  return [...normalizedRows, ...gradeAverageRows].sort((a, b) => {
    const scoreDiff = Number(b?.avg_score || 0) - Number(a?.avg_score || 0)
    if (scoreDiff !== 0) return scoreDiff
    if (a?.item_type === b?.item_type) return 0
    return a?.item_type === 'grade_avg' ? -1 : 1
  })
}

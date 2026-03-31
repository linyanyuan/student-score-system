const SUBJECT_NAME = {
  chinese: "\u8bed\u6587",
  chineseShort: "\u8bed",
  math: "\u6570\u5b66",
  mathShort: "\u6570",
  english: "\u82f1\u8bed",
  englishShort: "\u82f1",
}

const DEFAULT_SUBJECT_FULL_SCORES = {
  chinese: 120,
  math: 120,
  english: 120,
  other: 60,
}

export const inferSubjectFullScore = (subjectName) => {
  const normalized = String(subjectName || "").trim()
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
    const subject = String(row?.subject_name || "").trim() || `科目${index + 1}`
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

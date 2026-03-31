import assert from "node:assert/strict"
import { buildRadarSubjectPoints, inferSubjectFullScore, normalizeScoreToFullScore, resolveSubjectFullScore } from "./studentAnalysisUtils.js"

assert.equal(inferSubjectFullScore("语文"), 120)
assert.equal(inferSubjectFullScore("数学"), 120)
assert.equal(inferSubjectFullScore("英语"), 120)
assert.equal(inferSubjectFullScore("物理"), 60)
assert.equal(resolveSubjectFullScore("语文", 110), 110)
assert.equal(resolveSubjectFullScore("英语", "125"), 125)
assert.equal(resolveSubjectFullScore("语文", undefined), 120)
assert.equal(resolveSubjectFullScore("数学", 0), 120)
assert.equal(resolveSubjectFullScore("化学", null), 60)
assert.equal(normalizeScoreToFullScore(60, 120), 50)
assert.equal(normalizeScoreToFullScore(120, 120), 100)
assert.equal(normalizeScoreToFullScore(150, 120), 100)
assert.equal(normalizeScoreToFullScore(null, 120), 0)
assert.equal(normalizeScoreToFullScore(80, 0), 0)

const points = buildRadarSubjectPoints([
  { subject_name: "数学", student_score: "90", subject_full_score: 150 },
  { subject_name: "英语", student_score: 60, subject_full_score: 120 },
  { subject_name: "语文", student_score: 88, subject_full_score: null },
])

assert.deepEqual(points[0], { subject: "数学", student_score: 90, full_score: 150, score_rate: 60 })
assert.deepEqual(points[1], { subject: "英语", student_score: 60, full_score: 120, score_rate: 50 })
assert.deepEqual(points[2], { subject: "语文", student_score: 88, full_score: 120, score_rate: 73.33 })

console.log("student analysis full score fallback checks passed")
const topPoints = buildRadarSubjectPoints([
  { subject_name: "数学", student_score: 120, subject_full_score: 120 },
  { subject_name: "历史", student_score: 60, subject_full_score: 60 },
])
assert.equal(topPoints[0].score_rate, 100)
assert.equal(topPoints[1].score_rate, 100)

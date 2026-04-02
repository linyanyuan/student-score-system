import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const studentSource = await readFile(new URL('./StudentAnalysis.jsx', import.meta.url), 'utf8')
const classSource = await readFile(new URL('./ClassAnalysis.jsx', import.meta.url), 'utf8')

assert.match(studentSource, /getStudentScoreComparison/, 'student analysis should request score comparison data')
assert.match(studentSource, /buildTotalScoreComparisonBars/, 'student analysis should build total-score comparison data')
assert.match(studentSource, /buildSubjectScoreComparisonLineSeries/, 'student analysis should build subject line comparison data')
assert.ok(
  studentSource.includes('总分对比') || studentSource.includes('\\u603b\\u5206\\u5bf9\\u6bd4'),
  'student analysis should render the total-score comparison card',
)
assert.ok(
  studentSource.includes('各科成绩对比') || studentSource.includes('\\u5404\\u79d1\\u6210\\u7ee9\\u5bf9\\u6bd4'),
  'student analysis should render the subject comparison line chart card',
)
assert.match(studentSource, /<Col xs=\{24\} lg=\{8\}>/, 'student analysis should place total-score comparison on the left')
assert.match(studentSource, /<Col xs=\{24\} lg=\{16\}>/, 'student analysis should place subject comparison on the right')

assert.match(classSource, /buildRankChartRowsWithGradeAverage/, 'class analysis should augment rank rows with grade average rows')
assert.match(classSource, /item_type/, 'class analysis should style grade average rows differently')
assert.doesNotMatch(classSource, /name:\s*\(datum\)\s*=>/, 'class analysis tooltip names should not use unsupported dynamic callbacks')
assert.ok(
  classSource.includes('年级均分') || classSource.includes('\\u5e74\\u7ea7\\u5747\\u5206'),
  'class analysis should render grade average benchmark labels',
)

console.log('analysis comparison content checks passed')

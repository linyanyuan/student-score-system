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
assert.ok(
  classSource.includes('低分率得分') || classSource.includes('\\u4f4e\\u5206\\u7387\\u5f97\\u5206'),
  'class analysis should render the low-rate score column',
)
assert.ok(
  classSource.includes('优秀率(≥80%)') || classSource.includes('\\u4f18\\u79c0\\u7387(\\u226580%)'),
  'class distribution should use the 80% excellent threshold label',
)
assert.ok(
  classSource.includes('低分率(≤30%)') || classSource.includes('\\u4f4e\\u5206\\u7387(\\u226430%)'),
  'class distribution should render the low-score threshold label',
)
assert.match(
  classSource,
  /total_count/,
  'class distribution should use total_count instead of all-zero rates to decide empty state',
)
const fourRateIndex = classSource.indexOf('四率一分排名')
const classPickerIndex = classSource.indexOf('class-analysis-deep-pivot')
const deepAnalysisIndex = classSource.indexOf('以下为所选班级的深度分析')
assert.ok(fourRateIndex >= 0, 'class analysis should render the four-rate ranking card')
assert.ok(classPickerIndex >= 0, 'class analysis should render the class picker')
assert.ok(deepAnalysisIndex >= 0, 'class analysis should render the deep analysis divider')
assert.ok(
  fourRateIndex < classPickerIndex && classPickerIndex < deepAnalysisIndex,
  'class picker should sit between the four-rate ranking and deep analysis section',
)
assert.match(
  classSource,
  /className="class-analysis-deep-pivot"/,
  'class analysis should render the styled deep-analysis pivot toolbar',
)
assert.match(
  classSource,
  /className="class-analysis-empty-prompt"/,
  'class analysis should render the styled empty prompt for deep analysis',
)
assert.match(
  classSource,
  /className="class-analysis-page"/,
  'class analysis should render a styled page shell',
)
assert.match(
  classSource,
  /className="class-analysis-rank-grid"/,
  'class analysis should render the ranking charts in the shared visual system',
)
assert.ok(
  (classSource.match(/class-analysis-panel-card/g) || []).length >= 6,
  'class analysis cards should share the deep-analysis panel style',
)
assert.match(
  classSource,
  /import \{ Column \} from '@ant-design\/charts'/,
  'class distribution should only need the column chart library',
)
assert.match(
  classSource,
  /function RankListChart/,
  'class ranking charts should render as custom ranking lists',
)
assert.match(
  classSource,
  /className="class-analysis-distribution-grid"/,
  'class distribution should render a two-column chart layout',
)
assert.match(
  classSource,
  /buildDistributionSegments/,
  'class distribution should derive exclusive count segments for the pie chart',
)
assert.ok(
  classSource.includes('人数占比') || classSource.includes('\\u4eba\\u6570\\u5360\\u6bd4'),
  'class distribution should label the right panel as headcount share',
)
assert.match(
  classSource,
  /className="class-analysis-segment-bar"/,
  'class distribution should render a stacked segment bar instead of a pie chart',
)
assert.match(
  classSource,
  /className="class-analysis-segment-card"/,
  'class distribution should render compact segment cards',
)
assert.ok(
  classSource.includes('及格段') || classSource.includes('\\u53ca\\u683c\\u6bb5'),
  'class distribution segment cards should distinguish interval counts from cumulative pass counts',
)
assert.match(
  classSource,
  /fail_count/,
  'class distribution segment cards should use backend fail_count for the below-pass segment',
)
assert.match(
  classSource,
  /class-analysis-rate-label/,
  'class distribution column labels should display rates instead of headcounts',
)
assert.match(
  classSource,
  /rateName/,
  'class distribution tooltip should show only the hovered bar rate',
)
assert.doesNotMatch(
  classSource,
  /field: 'good_rate'|field: 'pass_rate'|field: 'low_rate'/,
  'class distribution tooltip should not render non-hovered rate fields',
)

console.log('analysis comparison content checks passed')

import assert from 'node:assert/strict'
import {
  buildRankChartRowsWithGradeAverage,
  buildSubjectScoreComparisonLineSeries,
  buildTotalScoreComparisonBars,
} from './studentAnalysisUtils.js'

const totalBars = buildTotalScoreComparisonBars([
  {
    dimension_name: '总分',
    student_score: 540,
    class_avg: 512.5,
    grade_avg: 506.2,
    highest_score: 560,
  },
  {
    dimension_name: '数学',
    student_score: 108,
    class_avg: 101.5,
    grade_avg: 99.8,
    highest_score: 116,
  },
])

assert.deepEqual(totalBars, [
  { label: '当前学生', score: 540 },
  { label: '班级均分', score: 512.5 },
  { label: '年级均分', score: 506.2 },
  { label: '最高分', score: 560 },
])

const subjectLineSeries = buildSubjectScoreComparisonLineSeries([
  {
    dimension_name: '总分',
    student_score: 540,
    class_avg: 512.5,
    grade_avg: 506.2,
    highest_score: 560,
  },
  {
    dimension_name: '数学',
    student_score: 108,
    class_avg: 101.5,
    grade_avg: 99.8,
    highest_score: 116,
  },
  {
    dimension_name: '英语',
    student_score: 112,
    class_avg: 104.3,
    grade_avg: 101.4,
    highest_score: 118,
  },
])

assert.deepEqual(subjectLineSeries, [
  { dimension: '数学', series: '当前学生', score: 108 },
  { dimension: '数学', series: '班级均分', score: 101.5 },
  { dimension: '数学', series: '年级均分', score: 99.8 },
  { dimension: '数学', series: '最高分', score: 116 },
  { dimension: '英语', series: '当前学生', score: 112 },
  { dimension: '英语', series: '班级均分', score: 104.3 },
  { dimension: '英语', series: '年级均分', score: 101.4 },
  { dimension: '英语', series: '最高分', score: 118 },
])

const rankRows = buildRankChartRowsWithGradeAverage([
  { class_name: '一班', avg_score: 521.4, grade_avg: 508.8, grade: '七年级' },
  { class_name: '二班', avg_score: 497.2, grade_avg: 508.8, grade: '七年级' },
  { class_name: '三班', avg_score: 533.6, grade_avg: 530.5, grade: '八年级' },
])

assert.deepEqual(rankRows, [
  { class_name: '三班', avg_score: 533.6, grade_avg: 530.5, grade: '八年级', item_type: 'class' },
  { class_name: '八年级均分', avg_score: 530.5, grade_avg: 530.5, grade: '八年级', item_type: 'grade_avg' },
  { class_name: '一班', avg_score: 521.4, grade_avg: 508.8, grade: '七年级', item_type: 'class' },
  { class_name: '七年级均分', avg_score: 508.8, grade_avg: 508.8, grade: '七年级', item_type: 'grade_avg' },
  { class_name: '二班', avg_score: 497.2, grade_avg: 508.8, grade: '七年级', item_type: 'class' },
])

console.log('student analysis score comparison utility checks passed')

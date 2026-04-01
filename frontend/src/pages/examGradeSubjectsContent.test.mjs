import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ExamManage.jsx', import.meta.url), 'utf8')

assert.match(source, /grade_subjects/)
assert.match(source, /renderGradeSubjectSummary|gradeSubject/)
assert.match(source, /getSubjects/)
assert.ok(
  source.includes('考试科目') || source.includes('\u8003\u8bd5\u79d1\u76ee'),
  'Exam manage should include grade subject configuration copy',
)

console.log('exam grade subjects content checks passed')

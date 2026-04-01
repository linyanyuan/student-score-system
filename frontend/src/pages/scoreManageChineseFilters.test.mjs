import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const teacherSource = await readFile(new URL('./TeacherClassManage.jsx', import.meta.url), 'utf8')
const scoreSource = await readFile(new URL('./ScoreManage.jsx', import.meta.url), 'utf8')

assert.ok(teacherSource.includes('绑定班级'), 'Teacher manage should include bind-class Chinese copy')
assert.ok(teacherSource.includes('选择已绑定班级（可多选）'), 'Teacher manage should include selected-class Chinese placeholder')

assert.ok(scoreSource.includes('选择班级'), 'Score manage should include class filter Chinese placeholder')
assert.ok(scoreSource.includes('学生学号'), 'Score manage should include student-no Chinese placeholder')
assert.ok(scoreSource.includes('学生姓名'), 'Score manage should include student-name Chinese placeholder')

console.log('score manage chinese filter checks passed')

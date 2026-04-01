import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ScoreManage.jsx', import.meta.url), 'utf8')
const addModalStart = source.indexOf('<Modal title="录入成绩"')
const addModalEnd = source.indexOf('<Modal title="批量导入成绩"')

assert.ok(addModalStart > -1 && addModalEnd > addModalStart, 'should contain the add-score modal block')

const addModalBlock = source.slice(addModalStart, addModalEnd)

assert.doesNotMatch(addModalBlock, /label="搜索学生"/, 'add-score modal should remove the extra student search input')
assert.doesNotMatch(source, /entryStudentKeyword/, 'score manage should not keep separate entry-student keyword state')
assert.doesNotMatch(source, /filteredEntryStudents/, 'score manage should not keep a separate filtered entry student list')
assert.match(addModalBlock, /showSearch/, 'student selector should support typing for autocomplete')
assert.match(addModalBlock, /filterOption=\{\(input, option\)/, 'student selector should filter options locally while typing')
assert.match(addModalBlock, /options=\{students\.map\(\(student\) => \(\{/, 'student selector should use the loaded student list directly')

console.log('score manage entry student autocomplete checks passed')

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ClassManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /dataSource=\{filteredRows\}/)
assert.match(source, /GRADE_RANK/)
assert.match(source, /compareGrade/)
assert.match(source, /gradeOptions[\s\S]*\.sort\(compareGrade\)/)
assert.match(source, /activeGradeFilter/)
assert.match(source, /setGradeFilter/)
assert.match(source, /setGradeFilter\(''\)/)
assert.match(source, /options=\{gradeOptions\.map/)
assert.match(source, /matchesGrade[\s\S]*activeGradeFilter/)
assert.ok(includesEither(String.raw`\u73ed\u7ea7\u603b\u6570`), 'Class manage should include class total copy')
assert.ok(includesEither(String.raw`\u6309\u5e74\u7ea7\u7b5b\u9009`), 'Class manage should include grade filter copy')
assert.ok(includesEither(String.raw`\u7b5b\u9009\u7ed3\u679c`), 'Class manage should include filtered result copy')
assert.ok(includesEither(String.raw`\u65b0\u5efa\u73ed\u7ea7`), 'Class manage should include create-class action copy')

console.log('class manage workspace content checks passed')

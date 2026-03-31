import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ExamManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /WorkspaceMetricCard/)
assert.match(source, /dataSource=\{filteredRows\}/)
assert.match(source, /nextExam/)
assert.match(source, /gradeCoverage/)
assert.ok(includesEither(String.raw`\u8003\u8bd5\u603b\u6570`), 'Exam manage should include exam total copy')
assert.ok(includesEither(String.raw`\u6700\u8fd1\u4e00\u573a\u8003\u8bd5`), 'Exam manage should include nearest exam copy')
assert.ok(includesEither(String.raw`\u6309\u53c2\u4e0e\u5e74\u7ea7\u8fc7\u6ee4`), 'Exam manage should include grade filter copy')
assert.ok(includesEither(String.raw`\u65b0\u5efa\u8003\u8bd5`), 'Exam manage should include create-exam action copy')

console.log('exam manage workspace content checks passed')

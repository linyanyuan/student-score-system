import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./SubjectManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /WorkspaceMetricCard/)
assert.match(source, /dataSource=\{filteredRows\}/)
assert.match(source, /normalizedGrades/)
assert.match(source, /uncoveredCount/)
assert.ok(includesEither(String.raw`\u79d1\u76ee\u603b\u6570`), 'Subject manage should include subject total copy')
assert.ok(includesEither(String.raw`\u9002\u7528\u5e74\u7ea7`), 'Subject manage should include grade coverage copy')
assert.ok(includesEither(String.raw`\u6309\u540d\u79f0\u6216\u4ee3\u7801\u641c\u7d22`), 'Subject manage should include keyword filter copy')
assert.ok(includesEither(String.raw`\u672a\u5206\u914d\u9002\u7528\u5e74\u7ea7`), 'Subject manage should include uncovered grade copy')

console.log('subject manage workspace content checks passed')

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./AccountManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /WorkspaceMetricCard/)
assert.match(source, /workspace-page/)
assert.match(source, /canSelectSchool/)
assert.match(source, /isSchoolAdmin/)
assert.match(source, /creationRoleOptions/)
assert.match(source, /\{canSelectSchool\s*&&\s*\(/)
assert.match(source, /defaultSchoolId/)
assert.ok(includesEither(String.raw`\u8d26\u6237\u7ba1\u7406`), 'AccountManage should include account-manage workspace copy')
assert.ok(includesEither(String.raw`\u65b0\u589e\u8d26\u6237`), 'AccountManage should include create-account action copy')
assert.ok(includesEither(String.raw`\u6559\u5e08`) && includesEither(String.raw`\u5b66\u751f`), 'AccountManage should include teacher and student role copy')

console.log('account manage workspace content checks passed')

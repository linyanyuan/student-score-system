import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./StudentManage.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /fieldDrawerOpen/)
assert.match(source, /fieldModalOpen/)
assert.match(source, /gradeDistribution/)
assert.match(source, /createCustomField/)
assert.match(source, /updateCustomField/)
assert.match(source, /deleteCustomField/)
assert.ok(includesEither(String.raw`\u6dfb\u52a0\u81ea\u5b9a\u4e49\u5b57\u6bb5`), 'Student manage should include add custom field action copy')
assert.ok(includesEither(String.raw`\u81ea\u5b9a\u4e49\u5b57\u6bb5`), 'Student manage should include custom field drawer copy')
assert.ok(includesEither(String.raw`\u5e74\u7ea7\u5206\u5e03`), 'Student manage should include grade distribution metric copy')
assert.ok(!includesEither(String.raw`\u5f53\u524d\u7ed3\u679c`), 'Student manage should no longer include current result metric copy')
assert.ok(
  includesEither(String.raw`\u5b57\u6bb5\u914d\u7f6e\u4f1a\u540c\u6b65\u5f71\u54cd\u5b66\u751f\u8868\u5355`) ||
    includesEither(String.raw`\u540c\u6b65\u5f71\u54cd\u5b66\u751f\u8868\u5355`),
  'Student manage should explain custom field impact',
)

console.log('student manage custom field drawer checks passed')

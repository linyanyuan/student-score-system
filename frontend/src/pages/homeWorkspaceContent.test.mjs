import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8')
const decode = (escaped) => JSON.parse(`"${escaped}"`)
const includesEither = (escaped) => source.includes(escaped) || source.includes(decode(escaped))

assert.match(source, /workspace-page/)
assert.match(source, /WorkspacePageHeader/)
assert.match(source, /WorkspaceSectionCard/)
assert.match(source, /WorkspaceMetricCard/)
assert.match(source, /home-focus-grid/)
assert.ok(includesEither(String.raw`\u5de5\u4f5c\u53f0`), 'Home should include workspace copy')
assert.ok(includesEither(String.raw`\u8bfe\u8868\u603b\u89c8`), 'Home should include timetable overview copy')
assert.ok(includesEither(String.raw`\u5907\u5fd8\u5f55`), 'Home should include memo copy')
assert.doesNotMatch(source, /title="\u5feb\u6377\u5165\u53e3"/, 'Home should hide quick-entry section')
const timetableIndex = source.indexOf('title="课表总览"')
const memoIndex = source.indexOf('title="备忘录"')
assert.ok(timetableIndex > -1 && memoIndex > -1 && timetableIndex < memoIndex, 'Home should render timetable before memo in focus layout')

console.log('home workspace content checks passed')

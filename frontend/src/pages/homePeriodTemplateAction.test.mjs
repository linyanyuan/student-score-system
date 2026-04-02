import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../api/schedule.js', import.meta.url), 'utf8')

assert.match(apiSource, /export const generateDefaultSchedulePeriodTemplate = \(\) =>/)
assert.match(apiSource, /request\.post\('\/api\/schedule-periods\/default-template'\)/)

assert.match(source, /generateDefaultSchedulePeriodTemplate/)
assert.match(source, /const handleGenerateDefaultPeriodTemplate = async \(\) =>/)
assert.match(source, /periods\.length === 0/)
assert.match(source, /一键生成默认节次模板/)
assert.match(source, /await generateDefaultSchedulePeriodTemplate\(\)/)
assert.match(source, /setPeriods\(generatedPeriods\)/)
assert.match(source, /setSelectedPeriod\(generatedPeriods\[0\]\)/)
assert.match(source, /setEditingPeriod\(generatedPeriods\[0\]\)/)

console.log('home period template action checks passed')

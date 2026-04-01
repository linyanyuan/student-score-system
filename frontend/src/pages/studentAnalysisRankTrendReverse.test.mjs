import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./StudentAnalysis.jsx', import.meta.url), 'utf8')
const rankStart = source.indexOf('const rankTrendConfig = {')
const rankEnd = source.indexOf('// Radar:')

assert.ok(rankStart > -1 && rankEnd > rankStart, 'should contain the rank trend config block')

const rankBlock = source.slice(rankStart, rankEnd)

assert.match(rankBlock, /scale\s*:\s*\{/, 'rank trend should define an explicit scale block')
assert.match(rankBlock, /y\s*:\s*\{[^}]*range\s*:\s*\[\s*1\s*,\s*0\s*\]/s, 'rank trend y scale should use range [1, 0] so smaller ranks appear at the top')
assert.doesNotMatch(rankBlock, /reverse\s*:\s*true/, 'rank trend should not rely on reverse because the official scale docs use range [1, 0]')

console.log('student analysis rank trend reverse checks passed')

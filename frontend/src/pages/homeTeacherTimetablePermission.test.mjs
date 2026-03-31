import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Home.jsx', import.meta.url), 'utf8')

assert.match(source, /import\s*\{[^}]*getScheduleTeachers[^}]*\}\s*from\s*'..\/api\/scheduling'/)
assert.doesNotMatch(source, /import\s*\{[^}]*getAccounts[^}]*\}\s*from\s*'..\/api\/account'/)
assert.match(source, /user\?\.role === 'school_admin'[\s\S]*?getScheduleTeachers\(\)/)
assert.doesNotMatch(source, /user\?\.role === 'school_admin'[\s\S]*?getAccounts\(\)/)

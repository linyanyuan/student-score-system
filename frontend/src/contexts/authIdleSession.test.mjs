import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const requestSource = await readFile(new URL('../api/request.js', import.meta.url), 'utf8')
const authSource = await readFile(new URL('./AuthContext.jsx', import.meta.url), 'utf8')
const loginSource = await readFile(new URL('../pages/Login.jsx', import.meta.url), 'utf8')

assert.match(requestSource, /isSessionIdleExpired/)
assert.match(requestSource, /clearSessionAuth/)
assert.match(requestSource, /redirectToLogin\('idle'\)/)

assert.match(authSource, /recordSessionActivity/)
assert.match(authSource, /isSessionIdleExpired/)
assert.match(authSource, /setInterval\(/)
assert.match(authSource, /addEventListener\(/)

assert.match(loginSource, /reason\s*===\s*'idle'/)
assert.match(loginSource, /navigate\('\/login',\s*\{\s*replace:\s*true\s*\}\)/)

console.log('auth idle-session checks passed')

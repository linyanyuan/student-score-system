import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const layoutSource = await readFile(new URL('./MainLayout.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../index.css', import.meta.url), 'utf8')

assert.match(layoutSource, /workspace-shell/)
assert.match(layoutSource, /workspace-topbar/)
assert.match(cssSource, /\.workspace-shell/)
assert.match(cssSource, /\.workspace-page/)

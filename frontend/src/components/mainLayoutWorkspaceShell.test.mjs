import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const layoutSource = await readFile(new URL('./MainLayout.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../index.css', import.meta.url), 'utf8')

assert.match(layoutSource, /const \[collapsed, setCollapsed\] = useState\(false\)/)
assert.match(layoutSource, /onClick=\{\(\) => setCollapsed\(!collapsed\)\}/)
assert.match(layoutSource, /selectedKeys=\{\[location\.pathname\]\}/)
assert.match(layoutSource, /onClick=\{\(\{ key \}\) => navigate\(key\)\}/)
assert.match(layoutSource, /Modal\.confirm\(\{[\s\S]*onOk: logout/)
assert.match(layoutSource, /workspace-shell/)
assert.match(layoutSource, /workspace-topbar/)
assert.match(layoutSource, /workspace-content-shell/)
assert.match(layoutSource, /workspace-content-inner/)
assert.doesNotMatch(layoutSource, /\/custom-fields/)
assert.match(cssSource, /\.workspace-shell/)
assert.match(cssSource, /\.workspace-page/)
assert.match(cssSource, /\.workspace-page\s*\{[\s\S]*?max-width:\s*none/)

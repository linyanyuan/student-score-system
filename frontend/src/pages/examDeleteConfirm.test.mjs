import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ExamManage.jsx', import.meta.url), 'utf8')

assert.match(source, /Modal\.confirm/)
assert.match(source, /删除本次考试/)
assert.match(source, /该考试已录入的成绩也会一并删除/)
assert.match(source, /okText:\s*['"]确认删除['"]/)
assert.match(source, /onOk:\s*\(\)\s*=>\s*handleDelete\(record\.id\)/)
assert.doesNotMatch(source, /<Popconfirm/)

console.log('exam delete confirmation checks passed')

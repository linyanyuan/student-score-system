import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8')

assert.match(source, /deleteSchedulePeriod/)
assert.match(source, /const \[selectedPeriod, setSelectedPeriod\] = useState\(null\)/)
assert.match(source, /const handleAddPeriodAfterSelected = \(\) =>/)
assert.match(source, /const handleDeleteSelectedPeriod = \(\) =>/)
assert.match(source, /setSelectedPeriod\(period\)/)
assert.match(source, /setPeriodModalVisible\(true\)/)
assert.match(source, /deleteSchedulePeriod\(selectedPeriod\.id\)/)
assert.match(source, /disabled=\{!selectedPeriod\}/)
assert.match(source, /当前选中：\{selectedPeriod\.name\}/)
assert.match(source, /sort_order: selectedPeriod\.sort_order \+ 1/)

console.log('home period selection action checks passed')

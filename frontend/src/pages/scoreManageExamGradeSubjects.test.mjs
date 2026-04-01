import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./ScoreManage.jsx', import.meta.url), 'utf8')

assert.match(source, /getScoreEntrySubjects/)
assert.match(source, /selectedEntryStudent|entrySubjects|entryStudentKeyword/)
assert.match(source, /editSubjects|visibleSubjectsForEdit|currentTableSubject/)
assert.match(source, /importDialog|importModal/)
assert.match(
  source,
  /const openEditModal = async|async function openEditModal/,
  'Score manage should load grade-scoped subjects before opening the edit modal',
)
assert.match(
  source,
  /openEditModal[\s\S]{0,2000}getScoreEntrySubjects/,
  'Score manage edit flow should fetch grade-scoped subjects for the selected student',
)
assert.match(
  source,
  /currentTableSubjectNames|visibleSubjectNames/,
  'Score manage edit flow should keep the edit fields aligned with the current table headers',
)
assert.ok(
  source.includes('瀵煎叆骞寸骇') || source.includes('\u5bfc\u5165\u5e74\u7ea7'),
  'Score manage should include import-grade selection in modal flow',
)

console.log('score manage exam grade subject checks passed')


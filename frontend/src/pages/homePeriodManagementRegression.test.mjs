import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8')

const adminSection = source.slice(
  source.indexOf('function AdminTimetableSection'),
  source.indexOf('function TeacherTimetableSection')
)
const teacherSection = source.slice(
  source.indexOf('function TeacherTimetableSection'),
  source.indexOf('function StudentTimetableSection')
)
const studentSection = source.slice(
  source.indexOf('function StudentTimetableSection'),
  source.indexOf('export default function Home')
)

assert.match(source, /function AdminTimetableSection\(\{ classes, teachers, periods \}\)/)
assert.match(source, /function TeacherTimetableSection\(\{ user, teacherClasses, periods \}\)/)
assert.match(source, /function StudentTimetableSection\(\{ user, periods \}\)/)

assert.doesNotMatch(adminSection, /const \[periods, setPeriods\] = useState\(\[\]\)/)
assert.doesNotMatch(teacherSection, /const \[periods, setPeriods\] = useState\(\[\]\)/)
assert.doesNotMatch(studentSection, /const \[periods, setPeriods\] = useState\(\[\]\)/)

assert.doesNotMatch(adminSection, /getSchedulePeriods\(\)/)
assert.doesNotMatch(teacherSection, /getSchedulePeriods\(\)/)
assert.doesNotMatch(studentSection, /getSchedulePeriods\(\)/)

assert.match(source, /<AdminTimetableSection classes=\{classes\} teachers=\{teachers\} periods=\{periods\} \/>/)
assert.match(source, /<TeacherTimetableSection user=\{user\} teacherClasses=\{classes\} periods=\{periods\} \/>/)
assert.match(source, /<StudentTimetableSection user=\{user\} periods=\{periods\} \/>/)

assert.match(source, /<Form\.Item name="name" label="节次名称" rules=\{\[\{ required: true, message: '请输入节次名称' \}\]\}>\s*<Input \/>/s)
assert.doesNotMatch(source, /<Input disabled=\{!isCreatingPeriodMode\} \/>/)

console.log('home period management regression checks passed')

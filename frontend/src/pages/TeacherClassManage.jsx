import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'

import request from '../api/request'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import {
  createTeacherClass,
  createTeacherSubjectAssignments,
  deleteTeacherClass,
  deleteTeacherSubjectAssignment,
  getTeacherClasses,
  getTeacherSubjectAssignments,
} from '../api/teacherClass'

const { Text } = Typography

const gradeRankMap = {
  一年级: 1,
  二年级: 2,
  三年级: 3,
  四年级: 4,
  五年级: 5,
  六年级: 6,
  七年级: 7,
  八年级: 8,
  九年级: 9,
  高一: 10,
  高二: 11,
  高三: 12,
}

function sortGrades(a, b) {
  const ra = gradeRankMap[a] ?? 999
  const rb = gradeRankMap[b] ?? 999
  if (ra !== rb) return ra - rb
  return String(a || '').localeCompare(String(b || ''), 'zh-Hans-CN')
}

function confirmAction({ title, content, okText = '确认', cancelText = '取消' }) {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

function parseGrades(raw) {
  if (!raw) return []
  return String(raw)
    .replaceAll('，', ',')
    .replaceAll('、', ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function subjectAppliesToAnyGrade(subject, gradeSet) {
  if (!subject) return false
  if (!gradeSet || gradeSet.size === 0) return true
  const grades = parseGrades(subject.grades)
  if (grades.length === 0) return true
  return grades.some((grade) => gradeSet.has(grade))
}

export default function TeacherClassManage() {
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedClassIds, setSelectedClassIds] = useState([])
  const [bindClassIds, setBindClassIds] = useState([])
  const [boundClassRows, setBoundClassRows] = useState([])
  const [matrixGrade, setMatrixGrade] = useState(undefined)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const classMap = useMemo(
    () =>
      Object.fromEntries(
        classes.map((c) => [c.id, c.grade ? `${c.grade}-${c.name}` : String(c.name || `班级ID:${c.id}`)])
      ),
    [classes]
  )
  const classInfoMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes])

  const teacherMap = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t.username])), [teachers])
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects])

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ label: t.username, value: t.id })),
    [teachers]
  )

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((c) => c.grade).filter(Boolean)))
        .sort(sortGrades)
        .map((g) => ({ label: g, value: g })),
    [classes]
  )

  const boundClassIds = useMemo(
    () => Array.from(new Set(boundClassRows.map((item) => item.class_id).filter(Boolean))),
    [boundClassRows]
  )

  const boundClassOptions = useMemo(
    () =>
      boundClassIds.map((id) => ({
        label: classMap[id] || `班级ID:${id}`,
        value: id,
      })),
    [boundClassIds, classMap]
  )

  const unboundClassOptions = useMemo(() => {
    const used = new Set(boundClassIds)
    return classes
      .filter((cls) => !used.has(cls.id))
      .map((cls) => ({
        label: cls.grade ? `${cls.grade}-${cls.name}` : String(cls.name || `班级ID:${cls.id}`),
        value: cls.id,
      }))
  }, [classes, boundClassIds])

  const selectedClassGradeSet = useMemo(() => {
    const set = new Set()
    selectedClassIds.forEach((classId) => {
      const row = classInfoMap[classId]
      if (row?.grade) set.add(row.grade)
    })
    return set
  }, [selectedClassIds, classInfoMap])

  const filteredAssignSubjectOptions = useMemo(
    () =>
      subjects
        .filter((subject) => subjectAppliesToAnyGrade(subject, selectedClassGradeSet))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'))
        .map((subject) => ({ label: subject.name, value: subject.id })),
    [subjects, selectedClassGradeSet]
  )

  const teacherAssignments = useMemo(
    () => assignments.filter((item) => item.teacher_id === selectedTeacher),
    [assignments, selectedTeacher]
  )

  const filteredClassesForMatrix = useMemo(() => {
    let rows = classes
    if (matrixGrade) rows = rows.filter((cls) => cls.grade === matrixGrade)
    return [...rows].sort((a, b) => {
      const byGrade = sortGrades(a.grade, b.grade)
      if (byGrade !== 0) return byGrade
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    })
  }, [classes, matrixGrade])

  const matrixGradeSet = useMemo(() => {
    const set = new Set()
    filteredClassesForMatrix.forEach((row) => {
      if (row?.grade) set.add(row.grade)
    })
    return set
  }, [filteredClassesForMatrix])

  const matrixSubjectOptions = useMemo(() => {
    if (!filteredClassesForMatrix.length) return []

    const scopedSubjects = subjects
      .filter((subject) => subjectAppliesToAnyGrade(subject, matrixGradeSet))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'))

    const classIdSet = new Set(filteredClassesForMatrix.map((item) => item.id))
    const usedSubjectIds = new Set(
      assignments
        .filter((item) => classIdSet.has(item.class_id))
        .map((item) => item.subject_id)
        .filter(Boolean)
    )

    const chosen = usedSubjectIds.size > 0 ? scopedSubjects.filter((s) => usedSubjectIds.has(s.id)) : scopedSubjects
    return chosen
  }, [filteredClassesForMatrix, assignments, subjects, matrixGradeSet])

  const assignmentCellMap = useMemo(() => {
    const map = new Map()
    assignments.forEach((item) => {
      map.set(`${item.class_id}_${item.subject_id}`, item)
    })
    return map
  }, [assignments])

  const groupedAssignments = useMemo(() => {
    const map = new Map()
    assignments.forEach((item) => {
      const key = `${item.teacher_id}_${item.subject_id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          teacher_id: item.teacher_id,
          teacher_name: item.teacher_name || teacherMap[item.teacher_id],
          subject_id: item.subject_id,
          subject_name: item.subject_name || subjectMap[item.subject_id],
          class_names: [],
          assignment_ids: [],
        })
      }
      const row = map.get(key)
      row.class_names.push(item.class_name || classMap[item.class_id] || `班级ID:${item.class_id}`)
      row.assignment_ids.push(item.id)
    })

    return Array.from(map.values()).sort((a, b) => {
      const teacherCmp = String(a.teacher_name || '').localeCompare(String(b.teacher_name || ''), 'zh-Hans-CN')
      if (teacherCmp !== 0) return teacherCmp
      return String(a.subject_name || '').localeCompare(String(b.subject_name || ''), 'zh-Hans-CN')
    })
  }, [assignments, teacherMap, subjectMap, classMap])

  const matrixColumns = useMemo(() => {
    const columns = [
      {
        title: '班级',
        dataIndex: 'class_name',
        key: 'class_name',
        fixed: 'left',
        width: 160,
        render: (value) => <Text strong>{value}</Text>,
      },
    ]

    matrixSubjectOptions.forEach((subject) => {
      columns.push({
        title: subject.name,
        key: `subject_${subject.id}`,
        dataIndex: `subject_${subject.id}`,
        width: 160,
        render: (cell) => {
          if (!cell) return <Text type="secondary">-</Text>
          return (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {cell.teacher_name || teacherMap[cell.teacher_id] || `教师ID:${cell.teacher_id}`}
            </Tag>
          )
        },
      })
    })

    return columns
  }, [matrixSubjectOptions, teacherMap])

  const matrixData = useMemo(
    () =>
      filteredClassesForMatrix.map((cls) => {
        const row = {
          key: String(cls.id),
          class_id: cls.id,
          class_name: cls.grade ? `${cls.grade}-${cls.name}` : String(cls.name || `班级ID:${cls.id}`),
        }
        matrixSubjectOptions.forEach((subject) => {
          row[`subject_${subject.id}`] = assignmentCellMap.get(`${cls.id}_${subject.id}`) || null
        })
        return row
      }),
    [filteredClassesForMatrix, matrixSubjectOptions, assignmentCellMap]
  )

  const refreshAssignments = async () => {
    setLoading(true)
    try {
      const res = await getTeacherSubjectAssignments()
      setAssignments(res.data || [])
    } catch (err) {
      message.error(err.message || '加载授课分配失败')
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  const refreshBoundClasses = async (teacherId) => {
    if (!teacherId) {
      setBoundClassRows([])
      return
    }
    try {
      const res = await getTeacherClasses(teacherId)
      setBoundClassRows(res.data || [])
    } catch (err) {
      message.error(err.message || '加载教师绑定班级失败')
      setBoundClassRows([])
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const [classRes, teacherRes, subjectRes] = await Promise.all([
          getClasses(),
          request.get('/api/auth/teachers'),
          getSubjects(),
        ])

        const nextClasses = classRes.data || []
        setClasses(nextClasses)
        setTeachers(teacherRes.data || [])
        setSubjects(subjectRes.data || [])

        const defaultGrade = Array.from(new Set(nextClasses.map((c) => c.grade).filter(Boolean))).sort(sortGrades)[0]
        setMatrixGrade(defaultGrade)
      } catch (err) {
        message.error(err.message || '加载基础数据失败')
      }
    })()
    refreshAssignments()
  }, [])

  useEffect(() => {
    if (!selectedSubject) return
    const valid = filteredAssignSubjectOptions.some((item) => item.value === selectedSubject)
    if (!valid) {
      setSelectedSubject(null)
    }
  }, [selectedSubject, filteredAssignSubjectOptions])

  const handleTeacherChange = (teacherId) => {
    setSelectedTeacher(teacherId || null)
    setSelectedSubject(null)
    setSelectedClassIds([])
    setBindClassIds([])
    refreshBoundClasses(teacherId)
  }

  const handleBindClass = async () => {
    if (!selectedTeacher) {
      message.warning('请先选择教师')
      return
    }
    if (!bindClassIds.length) {
      message.warning('请选择要绑定的班级（可多选）')
      return
    }

    const results = await Promise.allSettled(
      bindClassIds.map((classId) => createTeacherClass({ teacher_id: selectedTeacher, class_id: classId }))
    )
    const successCount = results.filter((item) => item.status === 'fulfilled').length
    const failedCount = results.length - successCount

    if (successCount > 0) message.success(`成功绑定 ${successCount} 个班级`)
    if (failedCount > 0) message.warning(`有 ${failedCount} 个班级绑定失败`)

    setBindClassIds([])
    refreshBoundClasses(selectedTeacher)
    refreshAssignments()
  }

  const handleUnbindClass = async (id) => {
    try {
      await deleteTeacherClass(id)
      message.success('已解除班级绑定')
      refreshBoundClasses(selectedTeacher)
      refreshAssignments()
    } catch (err) {
      message.error(err.message || '解除绑定失败')
    }
  }

  const handleAssign = async () => {
    if (!selectedTeacher) {
      message.warning('请先选择教师')
      return
    }
    if (!selectedSubject) {
      message.warning('请选择科目')
      return
    }
    if (!selectedClassIds.length) {
      message.warning('请至少选择一个班级')
      return
    }

    let replaceExisting = false
    const sameTeacherSameSubject = teacherAssignments.filter(
      (item) => item.teacher_id === selectedTeacher && item.subject_id === selectedSubject
    )

    if (sameTeacherSameSubject.length > 0) {
      const confirmed = await confirmAction({
        title: '检测到该教师已有同科目分配',
        content: '继续后将按本次选择覆盖该教师此科目的班级分配，是否继续？',
        okText: '重新分配',
      })
      if (!confirmed) return
      replaceExisting = true
    }

    const occupiedByOthers = assignments.filter(
      (item) =>
        item.subject_id === selectedSubject &&
        selectedClassIds.includes(item.class_id) &&
        item.teacher_id !== selectedTeacher
    )
    if (occupiedByOthers.length > 0) {
      const confirmed = await confirmAction({
        title: '检测到班级已有该科目教师',
        content: '继续后将覆盖这些班级当前科目教师分配，是否继续？',
        okText: '覆盖分配',
      })
      if (!confirmed) return
    }

    setSaving(true)
    try {
      await createTeacherSubjectAssignments({
        teacher_id: selectedTeacher,
        subject_id: selectedSubject,
        class_ids: selectedClassIds,
        replace_existing: replaceExisting,
      })
      message.success('授课分配成功')
      setSelectedClassIds([])
      await refreshAssignments()
    } catch (err) {
      message.error(err.message || '授课分配失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async (assignmentIds = []) => {
    if (!assignmentIds.length) return

    const results = await Promise.allSettled(assignmentIds.map((id) => deleteTeacherSubjectAssignment(id)))
    const successCount = results.filter((item) => item.status === 'fulfilled').length
    const failedCount = results.length - successCount

    if (successCount > 0) message.success(`已删除 ${successCount} 条分配`)
    if (failedCount > 0) message.warning(`有 ${failedCount} 条删除失败`)

    refreshAssignments()
  }

  const boundClassColumns = [
    {
      title: '已绑定班级',
      key: 'class_name',
      render: (_, row) => classMap[row.class_id] || `班级ID:${row.class_id}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Popconfirm title="确认解除该班级绑定？" onConfirm={() => handleUnbindClass(row.id)}>
          <Button danger size="small">
            解除绑定
          </Button>
        </Popconfirm>
      ),
    },
  ]

  const summaryColumns = [
    {
      title: '教师',
      dataIndex: 'teacher_name',
      key: 'teacher_name',
      width: 140,
      render: (value, row) => value || teacherMap[row.teacher_id] || `教师ID:${row.teacher_id}`,
    },
    {
      title: '科目',
      dataIndex: 'subject_name',
      key: 'subject_name',
      width: 140,
      render: (value, row) => value || subjectMap[row.subject_id] || `科目ID:${row.subject_id}`,
    },
    {
      title: '班级',
      dataIndex: 'class_names',
      key: 'class_names',
      render: (value = []) => (
        <Space wrap>
          {value.map((name) => (
            <Tag key={`${name}`}>{name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Popconfirm title="确认删除该教师该科目下所有分配？" onConfirm={() => handleDeleteGroup(row.assignment_ids)}>
          <Button danger size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="使用说明"
        description="先绑定教师与班级，再进行教师-科目-班级分配。科目会根据所选班级所在年级自动过滤。下方“班级-科目-教师矩阵”与 Excel 模板一致：第一行是科目，第一列是班级，中间显示授课教师。"
      />

      <Card size="small" title="教师绑定与分配">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              style={{ width: 220 }}
              placeholder="选择教师"
              allowClear
              showSearch
              optionFilterProp="label"
              value={selectedTeacher}
              onChange={handleTeacherChange}
              options={teacherOptions}
            />

            <Select
              style={{ width: 320 }}
              mode="multiple"
              maxTagCount="responsive"
              placeholder={selectedTeacher ? '选择已绑定班级（可多选）' : '请先选择教师'}
              disabled={!selectedTeacher}
              value={selectedClassIds}
              onChange={setSelectedClassIds}
              options={boundClassOptions}
            />

            <Select
              style={{ width: 240 }}
              placeholder="选择科目"
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={filteredAssignSubjectOptions}
              showSearch
              optionFilterProp="label"
            />

            <Button type="primary" onClick={handleAssign} loading={saving}>
              分配科目
            </Button>
          </Space>

          {selectedTeacher && (
            <>
              <Space wrap>
                <Select
                  style={{ width: 320 }}
                  mode="multiple"
                  maxTagCount="responsive"
                  placeholder="新增教师班级绑定（可多选）"
                  value={bindClassIds}
                  onChange={setBindClassIds}
                  options={unboundClassOptions}
                  showSearch
                  optionFilterProp="label"
                />
                <Button onClick={handleBindClass}>绑定班级</Button>
              </Space>

              <Table
                size="small"
                rowKey="id"
                columns={boundClassColumns}
                dataSource={boundClassRows}
                pagination={{
                  showSizeChanger: true,
                  pageSizeOptions: ['5', '10', '20', '50'],
                  showTotal: (total) => `共 ${total} 条`,
                }}
              />
            </>
          )}
        </Space>
      </Card>

      <Card
        size="small"
        title="班级-科目-教师矩阵"
        extra={
          <Space>
            <Text type="secondary">年级筛选</Text>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="全部年级"
              options={gradeOptions}
              value={matrixGrade}
              onChange={setMatrixGrade}
            />
          </Space>
        }
      >
        <Table
          rowKey="key"
          columns={matrixColumns}
          dataSource={matrixData}
          loading={loading}
          pagination={false}
          scroll={{ x: Math.max(900, 160 + matrixSubjectOptions.length * 160), y: 520 }}
          size="middle"
          bordered
        />
      </Card>

      <Card size="small" title="分配汇总（按教师-科目聚合）">
        <Table
          rowKey="key"
          columns={summaryColumns}
          dataSource={groupedAssignments}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </Space>
  )
}

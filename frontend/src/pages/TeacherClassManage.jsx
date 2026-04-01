import { useEffect, useMemo, useState } from 'react'
import { AlertOutlined, ApartmentOutlined, ReadOutlined, TeamOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'

import request from '../api/request'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'
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

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
}

const focusGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)',
  gap: 20,
  alignItems: 'start',
}

const stackStyle = {
  display: 'grid',
  gap: 16,
}

const compactStackStyle = {
  display: 'grid',
  gap: 12,
}

const infoPanelStyle = {
  border: '1px solid var(--workspace-panel-border)',
  background: 'rgba(248, 250, 252, 0.85)',
  borderRadius: 16,
  padding: 16,
}

const chipListStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
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
        classes.map((item) => [item.id, item.grade ? `${item.grade}-${item.name}` : String(item.name || `班级ID:${item.id}`)])
      ),
    [classes]
  )
  const classInfoMap = useMemo(() => Object.fromEntries(classes.map((item) => [item.id, item])), [classes])

  const teacherMap = useMemo(() => Object.fromEntries(teachers.map((item) => [item.id, item.username])), [teachers])
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((item) => [item.id, item.name])), [subjects])

  const teacherOptions = useMemo(() => teachers.map((item) => ({ label: item.username, value: item.id })), [teachers])

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((item) => item.grade).filter(Boolean)))
        .sort(sortGrades)
        .map((grade) => ({ label: grade, value: grade })),
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
      .filter((item) => !used.has(item.id))
      .map((item) => ({
        label: item.grade ? `${item.grade}-${item.name}` : String(item.name || `班级ID:${item.id}`),
        value: item.id,
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
    if (matrixGrade) rows = rows.filter((item) => item.grade === matrixGrade)
    return [...rows].sort((a, b) => {
      const byGrade = sortGrades(a.grade, b.grade)
      if (byGrade !== 0) return byGrade
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    })
  }, [classes, matrixGrade])

  const matrixGradeSet = useMemo(() => {
    const set = new Set()
    filteredClassesForMatrix.forEach((item) => {
      if (item?.grade) set.add(item.grade)
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

    return usedSubjectIds.size > 0 ? scopedSubjects.filter((item) => usedSubjectIds.has(item.id)) : scopedSubjects
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
      filteredClassesForMatrix.map((item) => {
        const row = {
          key: String(item.id),
          class_id: item.id,
          class_name: item.grade ? `${item.grade}-${item.name}` : String(item.name || `班级ID:${item.id}`),
        }
        matrixSubjectOptions.forEach((subject) => {
          row[`subject_${subject.id}`] = assignmentCellMap.get(`${item.id}_${subject.id}`) || null
        })
        return row
      }),
    [filteredClassesForMatrix, matrixSubjectOptions, assignmentCellMap]
  )

  const assignedTeacherIds = useMemo(() => new Set(assignments.map((item) => item.teacher_id).filter(Boolean)), [assignments])
  const totalBoundClassCount = useMemo(
    () => new Set([...assignments.map((item) => item.class_id), ...boundClassRows.map((item) => item.class_id)].filter(Boolean)).size,
    [assignments, boundClassRows]
  )
  const pendingCount = useMemo(
    () => teachers.filter((teacher) => !assignedTeacherIds.has(teacher.id)).length,
    [teachers, assignedTeacherIds]
  )

  const selectedTeacherName = selectedTeacher ? teacherMap[selectedTeacher] || `教师ID:${selectedTeacher}` : ''
  const selectedTeacherGrades = useMemo(
    () => Array.from(new Set(boundClassRows.map((item) => classInfoMap[item.class_id]?.grade).filter(Boolean))).sort(sortGrades),
    [boundClassRows, classInfoMap]
  )
  const selectedTeacherSubjectCount = useMemo(
    () => new Set(teacherAssignments.map((item) => item.subject_id).filter(Boolean)).size,
    [teacherAssignments]
  )

  const currentTeacherReminders = useMemo(() => {
    if (!selectedTeacher) {
      return ['先选择一位教师，再查看该教师的班级绑定和授课分配上下文。']
    }
    const reminders = []
    if (boundClassRows.length === 0) reminders.push('该教师还没有绑定班级，建议先建立服务范围。')
    if (boundClassRows.length > 0 && selectedTeacherSubjectCount === 0) reminders.push('该教师已绑定班级，但尚未完成科目分配。')
    if (selectedClassIds.length > 0 && filteredAssignSubjectOptions.length === 0) reminders.push('当前所选班级没有匹配科目，请先检查科目适用年级。')
    if (reminders.length === 0) reminders.push('当前教师的绑定与授课分配可以继续细化或回查。')
    return reminders
  }, [selectedTeacher, boundClassRows.length, selectedTeacherSubjectCount, selectedClassIds.length, filteredAssignSubjectOptions.length])

  const metrics = [
    {
      key: 'teachers',
      label: '教师总数',
      value: teachers.length,
      helper: teachers.length ? '当前参与教师管理配置的教师账号数量' : '暂无教师数据',
      accent: { background: '#e9f2ff', color: '#1d4ed8' },
      icon: <TeamOutlined />,
    },
    {
      key: 'bound',
      label: '已绑定班级',
      value: totalBoundClassCount,
      helper: totalBoundClassCount ? '已进入教师服务范围的班级关系数' : '尚未形成班级绑定',
      accent: { background: '#eff8ef', color: '#18794e' },
      icon: <ApartmentOutlined />,
    },
    {
      key: 'groups',
      label: '已分配科目组',
      value: groupedAssignments.length,
      helper: groupedAssignments.length ? '按教师-科目聚合的授课分配组' : '尚未生成授课分配',
      accent: { background: '#eef2ff', color: '#4338ca' },
      icon: <ReadOutlined />,
    },
    {
      key: 'pending',
      label: '待补齐项',
      value: pendingCount,
      helper: pendingCount ? '仍有教师尚未完成授课分配' : '教师分配状态已基本补齐',
      accent: { background: '#fff7e6', color: '#b45309' },
      icon: <AlertOutlined />,
    },
  ]

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

        const defaultGrade = Array.from(new Set(nextClasses.map((item) => item.grade).filter(Boolean))).sort(sortGrades)[0]
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
            <Tag key={name}>{name}</Tag>
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
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Teacher Workspace"
        title="教师管理工作台"
        description="围绕教师绑定、授课分配和覆盖提醒组织教师管理工作区，让主流程在首屏连续完成。"
        meta={(
          <Space size={12} wrap>
            <span>教师 {teachers.length} 人</span>
            <span>分配组 {groupedAssignments.length} 组</span>
            <span>待补齐 {pendingCount} 项</span>
          </Space>
        )}
      >
        <div style={metricGridStyle}>
          {metrics.map((item) => (
            <WorkspaceMetricCard
              key={item.key}
              icon={item.icon}
              label={item.label}
              value={item.value}
              helper={item.helper}
              accent={item.accent}
            />
          ))}
        </div>
      </WorkspacePageHeader>

      <div className="teacher-manage-focus-grid" style={focusGridStyle}>
        <WorkspaceSectionCard
          eyebrow="Primary Workflow"
          title="主流程工作区"
          description="先选择教师，再完成班级绑定和科目分配，减少跨区域来回切换。"
        >
          <div style={stackStyle}>
            <Alert
              type="info"
              showIcon
              message="使用说明"
              description="先绑定教师与班级，再进行教师-科目-班级分配。科目会根据所选班级所在年级自动过滤。"
            />

            <div style={compactStackStyle}>
              <Text strong>选择教师</Text>
              <Space wrap>
                <Select
                  style={{ width: 240 }}
                  placeholder="选择教师"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={selectedTeacher}
                  onChange={handleTeacherChange}
                  options={teacherOptions}
                />
                <Select
                  style={{ width: 360 }}
                  mode="multiple"
                  maxTagCount="responsive"
                  placeholder={selectedTeacher ? '新增教师班级绑定（可多选）' : '请先选择教师'}
                  disabled={!selectedTeacher}
                  value={bindClassIds}
                  onChange={setBindClassIds}
                  options={unboundClassOptions}
                  showSearch
                  optionFilterProp="label"
                />
                <Button onClick={handleBindClass} disabled={!selectedTeacher || !bindClassIds.length}>
                  绑定班级
                </Button>
              </Space>
            </div>

            <div style={compactStackStyle}>
              <Text strong>已绑定班级</Text>
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
                locale={{
                  emptyText: selectedTeacher ? <Empty description="该教师暂无班级绑定" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : '请先选择教师',
                }}
              />
            </div>

            <div style={compactStackStyle}>
              <Text strong>分配科目</Text>
              <Space wrap>
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
                  style={{ width: 260 }}
                  placeholder="选择科目"
                  value={selectedSubject}
                  onChange={setSelectedSubject}
                  options={filteredAssignSubjectOptions}
                  showSearch
                  optionFilterProp="label"
                  disabled={!selectedTeacher}
                />
                <Button type="primary" onClick={handleAssign} loading={saving} disabled={!selectedTeacher}>
                  分配科目
                </Button>
              </Space>
              {!selectedTeacher && <Alert type="warning" showIcon message="待处理提醒" description="先选择教师后，班级绑定和科目分配才会进入可操作状态。" />}
              {selectedTeacher && selectedClassIds.length === 0 && (
                <Alert type="warning" showIcon message="待处理提醒" description="已选择教师，但还没有选中要分配的班级。" />
              )}
            </div>
          </div>
        </WorkspaceSectionCard>

        <div className="teacher-manage-side-stack" style={stackStyle}>
          <WorkspaceSectionCard
            eyebrow="Teacher Snapshot"
            title="当前教师概览"
            description={selectedTeacher ? `围绕 ${selectedTeacherName} 的绑定和分配状态提供上下文。` : '选择教师后，这里会显示当前教师的上下文信息。'}
          >
            <div style={stackStyle}>
              <div style={infoPanelStyle}>
                <div style={compactStackStyle}>
                  <div>
                    <Text type="secondary">当前教师</Text>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{selectedTeacherName || '未选择教师'}</div>
                  </div>
                  <div>
                    <Text type="secondary">已绑定班级</Text>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{selectedTeacher ? boundClassRows.length : 0}</div>
                  </div>
                  <div>
                    <Text type="secondary">已分配科目</Text>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{selectedTeacher ? selectedTeacherSubjectCount : 0}</div>
                  </div>
                  <div>
                    <Text type="secondary">涉及年级</Text>
                    <div style={{ marginTop: 8, ...chipListStyle }}>
                      {selectedTeacherGrades.length ? selectedTeacherGrades.map((grade) => <Tag key={grade}>{grade}</Tag>) : <Text type="secondary">暂无年级范围</Text>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </WorkspaceSectionCard>

          <WorkspaceSectionCard
            eyebrow="Pending Signals"
            title="待处理提醒"
            description="把当前教师仍需补齐的关键动作集中放在侧栏。"
          >
            <div style={stackStyle}>
              {currentTeacherReminders.map((item) => (
                <Alert key={item} type="warning" showIcon message={item} />
              ))}
            </div>
          </WorkspaceSectionCard>
        </div>
      </div>

      <WorkspaceSectionCard
        eyebrow="矩阵总览"
        title="班级-科目-教师矩阵"
        description="按年级查看各班级在不同科目上的授课教师覆盖情况。"
        extra={(
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
        )}
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
      </WorkspaceSectionCard>

      <WorkspaceSectionCard
        eyebrow="Assignment Summary"
        title="分配汇总"
        description="按教师-科目聚合查看当前授课结果，便于回查与整组删除。"
      >
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
      </WorkspaceSectionCard>
    </div>
  )
}

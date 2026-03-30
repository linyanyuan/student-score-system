import { useState, useEffect, useMemo } from 'react'
import { Typography, Card, Row, Col, Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, message, Checkbox, TimePicker, Tabs, Space, Empty, Spin } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, CalendarOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { getDailyQuote, getMySchedule, getMemos, createMemo, updateMemo, deleteMemo, updateMemoStatus, getSchedulePeriods, createSchedulePeriod, createOrUpdateSchedule, deleteSchedule, updateSchedulePeriod } from '../api/schedule'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import { getClassTimetable, getTeacherTimetable, getMyTimetable } from '../api/scheduling'
import { getAccounts } from '../api/account'
import dayjs from 'dayjs'
import { buildSchedulePeriodPayload, isCreatingPeriod } from './homePeriodUtils'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

// ── 课表展示工具函数 ──────────────────────────────────────────────────────────
function buildTimetableRows(items, periods) {
  // periods: [{id, name, start_time, end_time}]
  // items: [{weekday, period_id, period_name, subject_name, class_name, teacher_name}]
  const periodList = periods.length > 0
    ? periods
    : Array.from(new Set(items.map(i => i.period_id))).sort((a, b) => a - b)
        .map(id => { const it = items.find(i => i.period_id === id); return { id, name: it?.period_name || `第${id}节`, start_time: '', end_time: '' } })
  return periodList.map(p => {
    const row = { key: String(p.id), period: p.name, time: p.start_time && p.end_time ? `${p.start_time}-${p.end_time}` : '' }
    for (let day = 1; day <= 5; day++) {
      row[`day${day}`] = items.find(i => i.period_id === p.id && i.weekday === day) || null
    }
    return row
  })
}

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五']
const DAY_COLORS = ['#eff6ff', '#f0fdf4', '#fdf4ff', '#fff7ed', '#fafaf9']
const DAY_BORDER_COLORS = ['#bfdbfe', '#bbf7d0', '#e9d5ff', '#fed7aa', '#e4e4e7']
const DAY_TEXT_COLORS = ['#1d4ed8', '#15803d', '#7e22ce', '#c2410c', '#3f3f46']

const SUBJECT_PALETTE = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fafaf9', border: '#e4e4e7', text: '#3f3f46' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#fefce8', border: '#fde68a', text: '#92400e' },
]

function subjectColor(subjectName) {
  if (!subjectName) return SUBJECT_PALETTE[4]
  let h = 0
  for (let i = 0; i < subjectName.length; i++) h = (h * 31 + subjectName.charCodeAt(i)) >>> 0
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length]
}

function makeTimetableColumns(showClass = false, showTeacher = true) {
  return [
    {
      title: <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>节次</span>,
      dataIndex: 'period',
      key: 'period',
      width: 72,
      fixed: 'left',
      render: v => <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>{v}</span>
    },
    {
      title: <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>时间</span>,
      dataIndex: 'time',
      key: 'time',
      width: 98,
      fixed: 'left',
      render: v => <span style={{ color: '#94a3b8', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    },
    ...DAY_NAMES.map((day, idx) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 20,
            background: DAY_COLORS[idx],
            color: DAY_TEXT_COLORS[idx],
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${DAY_BORDER_COLORS[idx]}`,
          }}>{day}</span>
        </div>
      ),
      dataIndex: `day${idx + 1}`,
      key: `day${idx + 1}`,
      render: (item) => {
        if (!item) return (
          <div style={{
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e2e8f0',
            fontSize: 18,
            userSelect: 'none',
          }}>·</div>
        )
        const c = subjectColor(item.subject_name)
        return (
          <div style={{
            minHeight: 52,
            padding: '6px 8px',
            borderRadius: 8,
            background: c.bg,
            border: `1px solid ${c.border}`,
            lineHeight: 1.45,
          }}>
            <div style={{ fontWeight: 700, color: c.text, fontSize: 13 }}>{item.subject_name || '—'}</div>
            {showClass && item.class_name && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                <TeamOutlined style={{ marginRight: 3 }} />{item.class_name}
              </div>
            )}
            {showTeacher && item.teacher_name && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                <UserOutlined style={{ marginRight: 3 }} />{item.teacher_name}
              </div>
            )}
          </div>
        )
      }
    }))
  ]
}

// ── 课表展示子组件 ────────────────────────────────────────────────────────────
function TimetableView({ items, periods, showClass = false, showTeacher = true, loading = false, emptyText = '暂无课表数据' }) {
  const rows = useMemo(() => buildTimetableRows(items, periods), [items, periods])
  const columns = useMemo(() => makeTimetableColumns(showClass, showTeacher), [showClass, showTeacher])
  return (
    <Spin spinning={loading}>
      <Table
        rowKey="key"
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 680 }}
        locale={{ emptyText: <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        className="timetable-pro"
      />
    </Spin>
  )
}

// ── 管理员课表区域 ─────────────────────────────────────────────────────────────
function AdminTimetableSection({ classes, teachers }) {
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClassId, setFilterClassId] = useState(null)
  const [filterTeacherId, setFilterTeacherId] = useState(null)
  const [timetableItems, setTimetableItems] = useState([])
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('class') // 'class' | 'teacher'

  useEffect(() => {
    getSchedulePeriods().then(r => setPeriods(r.data || [])).catch(() => {})
  }, [])

  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(classes.map(c => c.grade).filter(Boolean))).sort()
    return grades.map(g => ({ label: g, value: g }))
  }, [classes])

  const classOptions = useMemo(() => {
    const list = filterGrade ? classes.filter(c => c.grade === filterGrade) : classes
    return list.map(c => ({ label: filterGrade ? c.name : `${c.grade ? c.grade + '-' : ''}${c.name}`, value: c.id }))
  }, [classes, filterGrade])

  const teacherOptions = useMemo(() => teachers.map(t => ({ label: t.username, value: t.id })), [teachers])

  const loadClassTimetable = async (classId) => {
    if (!classId) return
    setLoading(true)
    try {
      const res = await getClassTimetable(classId)
      setTimetableItems(res.data?.items || [])
    } catch { message.error('加载班级课表失败') }
    finally { setLoading(false) }
  }

  const loadTeacherTimetable = async (teacherId) => {
    if (!teacherId) return
    setLoading(true)
    try {
      const res = await getTeacherTimetable(teacherId)
      setTimetableItems(res.data?.items || [])
    } catch { message.error('加载教师课表失败') }
    finally { setLoading(false) }
  }

  const handleClassChange = (id) => {
    setFilterClassId(id)
    setFilterTeacherId(null)
    setActiveMode('class')
    setTimetableItems([])
    if (id) loadClassTimetable(id)
  }

  const handleTeacherChange = (id) => {
    setFilterTeacherId(id)
    setFilterClassId(null)
    setActiveMode('teacher')
    setTimetableItems([])
    if (id) loadTeacherTimetable(id)
  }

  const handleGradeChange = (g) => {
    setFilterGrade(g)
    setFilterClassId(null)
    setFilterTeacherId(null)
    setTimetableItems([])
  }

  const showClass = activeMode === 'teacher'
  const showTeacher = activeMode === 'class'

  const selectedLabel = filterClassId
    ? classOptions.find(o => o.value === filterClassId)?.label
    : filterTeacherId
    ? teacherOptions.find(o => o.value === filterTeacherId)?.label
    : null

  const emptyText = !filterClassId && !filterTeacherId ? '请选择班级或教师查看课表' : '暂无课表数据'

  return (
    <Card
      className="timetable-section-card"
      styles={{ body: { padding: 0 } }}
      style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e8edf5', boxShadow: '0 4px 24px rgba(15,23,42,0.07)' }}
    >
      {/* 顶栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '16px 20px',
        background: 'linear-gradient(135deg,#f8faff 0%,#eef4ff 100%)',
        borderBottom: '1px solid #e8edf5',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarOutlined style={{ fontSize: 18, color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>课表总览</span>
          {selectedLabel && (
            <Tag color="blue" style={{ marginLeft: 4, fontWeight: 600 }}>{selectedLabel}</Tag>
          )}
        </div>
        <Space wrap>
          <Select
            allowClear
            placeholder="年级"
            options={gradeOptions}
            value={filterGrade || undefined}
            style={{ width: 110 }}
            onChange={handleGradeChange}
            suffixIcon={<span style={{ fontSize: 11, color: '#94a3b8' }}>▾</span>}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={filterGrade ? `${filterGrade} 班级` : '选择班级'}
            options={classOptions}
            value={filterClassId || undefined}
            style={{ width: 160 }}
            onChange={handleClassChange}
            suffixIcon={<TeamOutlined style={{ color: filterClassId ? '#2563eb' : '#94a3b8' }} />}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="选择教师"
            options={teacherOptions}
            value={filterTeacherId || undefined}
            style={{ width: 150 }}
            onChange={handleTeacherChange}
            suffixIcon={<UserOutlined style={{ color: filterTeacherId ? '#2563eb' : '#94a3b8' }} />}
          />
        </Space>
      </div>
      {/* 课表主体 */}
      <div style={{ padding: '16px 20px' }}>
        <TimetableView
          items={timetableItems}
          periods={periods}
          showClass={showClass}
          showTeacher={showTeacher}
          loading={loading}
          emptyText={emptyText}
        />
      </div>
    </Card>
  )
}

// ── 教师课表区域 ───────────────────────────────────────────────────────────────
function TeacherTimetableSection({ user, teacherClasses }) {
  const [myItems, setMyItems] = useState([])
  const [classItems, setClassItems] = useState([])
  const [periods, setPeriods] = useState([])
  const [myLoading, setMyLoading] = useState(false)
  const [classLoading, setClassLoading] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(null)

  useEffect(() => {
    getSchedulePeriods().then(r => setPeriods(r.data || [])).catch(() => {})
    setMyLoading(true)
    getMyTimetable()
      .then(r => setMyItems(r.data?.items || []))
      .catch(() => {})
      .finally(() => setMyLoading(false))
  }, [])

  const classOptions = useMemo(() => teacherClasses.map(c => ({ label: `${c.grade ? c.grade + '-' : ''}${c.name}`, value: c.id })), [teacherClasses])

  const handleClassChange = async (id) => {
    setSelectedClassId(id)
    setClassItems([])
    if (!id) return
    setClassLoading(true)
    try {
      const res = await getClassTimetable(id)
      setClassItems(res.data?.items || [])
    } catch { message.error('加载班级课表失败') }
    finally { setClassLoading(false) }
  }

  const tabItems = [
    {
      key: 'my',
      label: <span><UserOutlined /> 我的课表</span>,
      children: (
        <div style={{ padding: '16px 20px' }}>
          <TimetableView items={myItems} periods={periods} showClass={true} showTeacher={false} loading={myLoading} emptyText="暂无课表，课表发布后将在此显示" />
        </div>
      ),
    },
    {
      key: 'class',
      label: <span><TeamOutlined /> 班级课表</span>,
      children: (
        <div style={{ padding: '16px 20px' }}>
          <Select
            allowClear
            placeholder="选择所教班级"
            options={classOptions}
            value={selectedClassId || undefined}
            style={{ width: 200, marginBottom: 16 }}
            onChange={handleClassChange}
            suffixIcon={<TeamOutlined style={{ color: selectedClassId ? '#2563eb' : '#94a3b8' }} />}
          />
          <TimetableView items={classItems} periods={periods} showClass={false} showTeacher={true} loading={classLoading} emptyText={selectedClassId ? '暂无课表数据' : '请选择班级'} />
        </div>
      ),
    }
  ]

  return (
    <Card
      style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e8edf5', boxShadow: '0 4px 24px rgba(15,23,42,0.07)', padding: 0 }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 20px',
        background: 'linear-gradient(135deg,#f8faff 0%,#eef4ff 100%)',
        borderBottom: '1px solid #e8edf5',
      }}>
        <CalendarOutlined style={{ fontSize: 18, color: '#2563eb' }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>我的课表</span>
      </div>
      <Tabs defaultActiveKey="my" items={tabItems} style={{ margin: 0 }} tabBarStyle={{ paddingLeft: 20, marginBottom: 0 }} />
    </Card>
  )
}

// ── 学生课表区域 ───────────────────────────────────────────────────────────────
function StudentTimetableSection({ user }) {
  const [items, setItems] = useState([])
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getSchedulePeriods().then(r => setPeriods(r.data || [])).catch(() => {})
    setLoading(true)
    getMyTimetable()
      .then(r => setItems(r.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card
      style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e8edf5', boxShadow: '0 4px 24px rgba(15,23,42,0.07)' }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 20px',
        background: 'linear-gradient(135deg,#f8faff 0%,#eef4ff 100%)',
        borderBottom: '1px solid #e8edf5',
      }}>
        <CalendarOutlined style={{ fontSize: 18, color: '#2563eb' }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>班级课表</span>
        {user?.student_name && (
          <Tag color="blue" style={{ marginLeft: 4 }}>{user.student_name}</Tag>
        )}
      </div>
      <div style={{ padding: '16px 20px' }}>
        {!user?.student_id ? (
          <Empty description="账号未绑定学生信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <TimetableView items={items} periods={periods} showClass={false} showTeacher={true} loading={loading} emptyText="暂无课表，课表发布后将在此显示" />
        )}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth()
  const [quote, setQuote] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [periods, setPeriods] = useState([])
  const [memos, setMemos] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [memoModalVisible, setMemoModalVisible] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [periodModalVisible, setPeriodModalVisible] = useState(false)
  const [editingMemo, setEditingMemo] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [memoForm] = Form.useForm()
  const [scheduleForm] = Form.useForm()
  const [periodForm] = Form.useForm()

  const showScheduleSection = ['school_admin', 'teacher', 'student'].includes(user?.role)
  const canLoadScheduleEditorMeta = user?.role === 'teacher' || user?.role === 'school_admin'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    // 加载每日语句
    try {
      const quoteRes = await getDailyQuote()
      setQuote(quoteRes.data)
    } catch (error) {
      console.error('加载每日语句失败:', error)
    }

    // 加载备忘录 - 所有角色
    try {
      const memosRes = await getMemos({ status: 'pending', limit: 5 })
      setMemos(memosRes.data)
    } catch (error) {
      console.error('加载备忘录失败:', error)
    }
    if (showScheduleSection) {
      // 加载节次
      try {
        const periodsRes = await getSchedulePeriods()
        setPeriods(periodsRes.data)
      } catch (error) {
        console.error('加载节次失败:', error)
      }
    }

    if (canLoadScheduleEditorMeta) {
      // 加载班级和科目
      try {
        const classesRes = await getClasses()
        setClasses(classesRes.data)
      } catch (error) {
        console.error('加载班级失败:', error)
      }

      try {
        const subjectsRes = await getSubjects()
        setSubjects(subjectsRes.data)
      } catch (error) {
        console.error('加载科目失败:', error)
      }
    }

    if (user?.role === 'school_admin') {
      try {
        const accountsRes = await getAccounts()
        setTeachers((accountsRes.data || []).filter(u => u.role === 'teacher'))
      } catch (error) {
        console.error('加载教师失败:', error)
      }
    }

    if (user?.role === 'teacher') {
      // 教师课表由 TeacherTimetableSection 内部加载
      try {
        const scheduleRes = await getMySchedule()
        setSchedule(scheduleRes.data)
      } catch (error) {
        console.error('加载课表失败:', error)
      }
    }
  }

  const handleCreateMemo = () => {
    setEditingMemo(null)
    memoForm.resetFields()
    setMemoModalVisible(true)
  }

  const handleEditMemo = (memo) => {
    setEditingMemo(memo)
    memoForm.setFieldsValue({
      ...memo,
      due_date: memo.due_date ? dayjs(memo.due_date) : null
    })
    setMemoModalVisible(true)
  }

  const handleMemoSubmit = async () => {
    try {
      const values = await memoForm.validateFields()
      const data = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      }

      if (editingMemo) {
        await updateMemo(editingMemo.id, data)
        message.success('更新成功')
      } else {
        await createMemo(data)
        message.success('创建成功')
      }

      setMemoModalVisible(false)
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDeleteMemo = async (id) => {
    try {
      await deleteMemo(id)
      message.success('删除成功')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleToggleMemoStatus = async (memo) => {
    try {
      const newStatus = memo.status === 'pending' ? 'completed' : 'pending'
      await updateMemoStatus(memo.id, newStatus)
      message.success('状态更新成功')
      loadData()
    } catch (error) {
      message.error('状态更新失败')
    }
  }

  const handleEditSchedule = (periodId, weekday) => {
    const existing = schedule.find(s => s.period_id === periodId && s.weekday === weekday)
    setEditingSchedule({ periodId, weekday, existing })
    scheduleForm.setFieldsValue({
      class_id: existing?.class_id,
      subject_id: existing?.subject_id
    })
    setScheduleModalVisible(true)
  }

  const handleScheduleSubmit = async () => {
    try {
      const values = await scheduleForm.validateFields()
      await createOrUpdateSchedule({
        period_id: editingSchedule.periodId,
        weekday: editingSchedule.weekday,
        class_id: values.class_id || null,
        subject_id: values.subject_id || null
      })
      message.success('保存成功')
      setScheduleModalVisible(false)
      loadData()
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteSchedule(id)
      message.success('删除成功')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleEditPeriod = (period) => {
    setEditingPeriod(period)
    periodForm.setFieldsValue({
      name: period.name,
      start_time: dayjs(period.start_time, 'HH:mm'),
      end_time: dayjs(period.end_time, 'HH:mm')
    })
    setPeriodModalVisible(true)
  }

  const handleManagePeriods = () => {
    setEditingPeriod(null)
    periodForm.resetFields()
    periodForm.setFieldsValue({ sort_order: periods.length + 1 })
    setPeriodModalVisible(true)
  }

  const handlePeriodSubmit = async () => {
    try {
      const values = await periodForm.validateFields()

      if (isCreatingPeriod(editingPeriod)) {
        await createSchedulePeriod(buildSchedulePeriodPayload(values))
        message.success('创建成功')
        setPeriodModalVisible(false)
        setEditingPeriod(null)
        periodForm.resetFields()
        await loadData()
        return
      }

      const newStartTime = values.start_time.format('HH:mm')
      const oldStartTime = editingPeriod.start_time

      const oldStart = dayjs(oldStartTime, 'HH:mm')
      const newStart = dayjs(newStartTime, 'HH:mm')
      const timeDiff = newStart.diff(oldStart, 'minute')

      if (timeDiff !== 0) {
        Modal.confirm({
          title: '是否同步后续节次？',
          content: `本次调整了 ${Math.abs(timeDiff)} 分钟，是否同时调整后续节次时间？`,
          okText: '同步',
          cancelText: '不同步',
          onOk: async () => {
            await updatePeriodWithAdjustment(editingPeriod.id, values, timeDiff, true)
          },
          onCancel: async () => {
            await updatePeriodWithAdjustment(editingPeriod.id, values, timeDiff, false)
          }
        })
      } else {
        await updatePeriodWithAdjustment(editingPeriod.id, values, 0, false)
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  const updatePeriodWithAdjustment = async (periodId, values, timeDiff, adjustOthers) => {
    try {
      const data = {
        name: values.name,
        start_time: values.start_time.format('HH:mm'),
        end_time: values.end_time.format('HH:mm')
      }

      await updateSchedulePeriod(periodId, data)

      // 如果需要调整其他节次
      if (adjustOthers && timeDiff !== 0) {
        const currentIndex = periods.findIndex(p => p.id === periodId)
        const laterPeriods = periods.slice(currentIndex + 1)

        for (const period of laterPeriods) {
          const oldStart = dayjs(period.start_time, 'HH:mm')
          const oldEnd = dayjs(period.end_time, 'HH:mm')
          const newStart = oldStart.add(timeDiff, 'minute')
          const newEnd = oldEnd.add(timeDiff, 'minute')

          await updateSchedulePeriod(period.id, {
            start_time: newStart.format('HH:mm'),
            end_time: newEnd.format('HH:mm')
          })
        }
      }

      message.success('更新成功')
      setPeriodModalVisible(false)
      loadData()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const isCreatingPeriodMode = isCreatingPeriod(editingPeriod)

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red'
      case 'medium': return 'orange'
      case 'low': return 'green'
      default: return 'default'
    }
  }

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return '高'
      case 'medium': return '中'
      case 'low': return '低'
      default: return priority
    }
  }

  // 构建课表数据结构
  const scheduleTable = periods.map(period => {
    const row = { period: period.name, time: `${period.start_time}-${period.end_time}` }
    for (let day = 1; day <= 5; day++) {
      const item = schedule.find(s => s.period_id === period.id && s.weekday === day)
      row[`day${day}`] = item
    }
    return row
  })

  const scheduleColumns = [
    { title: '节次', dataIndex: 'period', key: 'period', width: 100 },
    { title: '时间', dataIndex: 'time', key: 'time', width: 120 },
    ...['周一', '周二', '周三', '周四', '周五'].map((day, index) => ({
      title: day,
      dataIndex: `day${index + 1}`,
      key: `day${index + 1}`,
      render: (item, record) => {
        const periodId = periods.find(p => p.name === record.period)?.id
        const canEditSchedule = user?.role === 'teacher'
        return (
          <div
            style={{ cursor: canEditSchedule ? 'pointer' : 'default', minHeight: 40, padding: 4 }}
            onClick={() => canEditSchedule && handleEditSchedule(periodId, index + 1)}
          >
            {item ? (
              <div>
                <div>{item.class_name}-{item.subject_name}</div>
                {canEditSchedule && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSchedule(item.id)
                    }}
                  >
                    删除
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ color: '#999' }}>{canEditSchedule ? '点击添加' : ''}</div>
            )}
          </div>
        )
      }
    }))
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 每日语句 */}
      {quote && (
        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Paragraph style={{ fontSize: 18, marginBottom: 8, color: 'white' }}>
            "{quote.content}"
          </Paragraph>
          {quote.source && (
            <Paragraph style={{ textAlign: 'right', marginBottom: 0, color: 'rgba(255,255,255,0.8)' }}>
              — {quote.source}
            </Paragraph>
          )}
        </Card>
      )}

      <Row gutter={24}>
        {/* 课表区域 - 仅 school_admin / teacher / student 可见 */}
        {showScheduleSection && (
          <Col xs={24} xl={15}>
            {user?.role === 'school_admin' && (
              <AdminTimetableSection
                classes={classes}
                teachers={teachers}
                periods={periods}
                onManagePeriods={handleManagePeriods}
              />
            )}
            {user?.role === 'teacher' && (
              <TeacherTimetableSection user={user} teacherClasses={classes} />
            )}
            {user?.role === 'student' && (
              <StudentTimetableSection user={user} />
            )}
          </Col>
        )}

        {/* 备忘录区域 - 所有角色可见 */}
        <Col xs={24} xl={showScheduleSection ? 9 : 24}>
          <Card
            title="备忘录"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMemo}>
                新建
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {memos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无待办事项
              </div>
            ) : (
              memos.map(memo => (
                <Card
                  key={memo.id}
                  size="small"
                  style={{ marginBottom: 12 }}
                  actions={[
                    <EditOutlined key="edit" onClick={() => handleEditMemo(memo)} />,
                    <DeleteOutlined key="delete" onClick={() => handleDeleteMemo(memo.id)} />
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <Checkbox
                      checked={memo.status === 'completed'}
                      onChange={() => handleToggleMemoStatus(memo)}
                    />
                    <span style={{ marginLeft: 8, flex: 1, textDecoration: memo.status === 'completed' ? 'line-through' : 'none' }}>
                      {memo.title}
                    </span>
                    <Tag color={getPriorityColor(memo.priority)}>{getPriorityLabel(memo.priority)}</Tag>
                  </div>
                  {memo.description && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{memo.description}</div>
                  )}
                  {memo.due_date && (
                    <div style={{ fontSize: 12, color: dayjs(memo.due_date).isBefore(dayjs()) ? 'red' : '#999' }}>
                      截止: {memo.due_date}
                    </div>
                  )}
                </Card>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* 备忘录编辑弹窗 */}
      <Modal
        title={editingMemo ? '编辑备忘录' : '新建备忘录'}
        open={memoModalVisible}
        onOk={handleMemoSubmit}
        onCancel={() => setMemoModalVisible(false)}
      >
        <Form form={memoForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="如：教学任务、会议等" />
          </Form.Item>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 课表编辑弹窗 */}
      <Modal
        title="编辑课表"
        open={scheduleModalVisible}
        onOk={handleScheduleSubmit}
        onCancel={() => setScheduleModalVisible(false)}
      >
        <Form form={scheduleForm} layout="vertical">
          <Form.Item name="class_id" label="班级">
            <Select allowClear placeholder="选择班级">
              {classes.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="subject_id" label="科目">
            <Select allowClear placeholder="选择科目">
              {subjects.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 节次编辑弹窗 */}
      <Modal
        title={isCreatingPeriodMode ? '新增节次' : '编辑节次时间'}
        open={periodModalVisible}
        onOk={handlePeriodSubmit}
        onCancel={() => setPeriodModalVisible(false)}
        footer={undefined}
        width={600}
      >
        {isCreatingPeriodMode && periods.length === 0 && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4, color: '#ad4e00' }}>
            当前暂无节次数据，请先补充节次信息后再进行编辑。
          </div>
        )}
        <Form form={periodForm} layout="vertical">
          <Form.Item name="name" label="节次名称" rules={[{ required: true, message: '请输入节次名称' }]}>
            <Input disabled={!isCreatingPeriodMode} />
          </Form.Item>
          {isCreatingPeriodMode && (
            <Form.Item name="sort_order" label="排序" initialValue={1} rules={[{ required: true, message: '请输入排序' }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            提示：修改时间后，系统会询问是否同步调整后续节次的时间
          </p>
        </div>
        {periods.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 'bold', marginBottom: 8 }}>所有节次：</p>
            {periods.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: editingPeriod?.id === p.id ? '#e6f7ff' : '#fafafa',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
                onClick={() => handleEditPeriod(p)}
              >
                <span>{p.name}</span>
                <span style={{ color: '#666' }}>{p.start_time} - {p.end_time}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

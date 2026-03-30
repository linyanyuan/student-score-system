import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { getClasses } from '../api/class'
import { getSchedulePeriods } from '../api/schedule'
import { getSubjects } from '../api/subject'
import {
  createAutoScheduleTask,
  getClassTimetable,
  getLessonPlan,
  getLessonPlanOverrides,
  getScheduleDraft,
  getScheduleDraftItems,
  getScheduleTask,
  getScheduleTeachers,
  getTeacherConstraints,
  getTeachingArrangement,
  getTimetableLocks,
  publishScheduleDraft,
  saveLessonPlan,
  saveLessonPlanOverrides,
  saveTeacherConstraints,
  saveTeachingArrangement,
  saveTimetableLocks,
} from '../api/scheduling'
import { buildConfigWarnings, buildSummaryCounts, buildTimetableRows, formatForbiddenPeriods, parseForbiddenPeriods } from './scheduleManageUtils'

const { Title, Text } = Typography
const SESSION_OPTIONS = [
  { label: '不限', value: 'any' },
  { label: '偏上午', value: 'morning_prefer' },
  { label: '偏下午', value: 'afternoon_prefer' },
]
const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
]
const GRADE_RANK = { 一年级: 1, 二年级: 2, 三年级: 3, 四年级: 4, 五年级: 5, 六年级: 6, 七年级: 7, 八年级: 8, 九年级: 9, 高一: 10, 高二: 11, 高三: 12 }
const createEmptyPlan = () => ({ subject_id: undefined, weekly_hours: 2, daily_max_hours: 1, preferred_session: 'any', forbidden_periods_text: '' })
const createEmptyArrangement = () => ({ class_id: undefined, subject_id: undefined, teacher_id: undefined })
const createEmptyOverride = () => ({ class_id: undefined, subject_id: undefined, weekly_hours: 2, daily_max_hours: 1, preferred_session: 'any', forbidden_periods_text: '' })
const createEmptyTeacherConstraint = () => ({ teacher_id: undefined, daily_max_hours: 4, forbidden_periods_text: '', preferred_periods_text: '' })
const createEmptyLock = () => ({ class_id: undefined, subject_id: undefined, teacher_id: undefined, weekday: 1, period_id: undefined, source: 'manual', note: '' })
const compareGrade = (a, b) => (GRADE_RANK[a] ?? 999) - (GRADE_RANK[b] ?? 999) || String(a).localeCompare(String(b), 'zh-Hans-CN')
const normalizePlans = (items) => (items.length ? items : [createEmptyPlan()]).map((item) => ({ ...item, forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods) }))
const normalizeOverrides = (items) => (items.length ? items : [createEmptyOverride()]).map((item) => ({ ...item, forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods) }))
const normalizeTeacherConstraints = (items) => (items.length ? items : [createEmptyTeacherConstraint()]).map((item) => ({ ...item, forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods), preferred_periods_text: formatForbiddenPeriods(item.preferred_periods) }))
const normalizeArrangements = (items) => (items.length ? items : [createEmptyArrangement()])
const normalizeLocks = (items) => (items.length ? items : [createEmptyLock()])

export default function ScheduleManage() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [periods, setPeriods] = useState([])
  const [grade, setGrade] = useState('')
  const [plans, setPlans] = useState([createEmptyPlan()])
  const [arrangements, setArrangements] = useState([createEmptyArrangement()])
  const [overrides, setOverrides] = useState([createEmptyOverride()])
  const [teacherConstraints, setTeacherConstraints] = useState([createEmptyTeacherConstraint()])
  const [locks, setLocks] = useState([createEmptyLock()])
  const [task, setTask] = useState(null)
  const [currentDraftId, setCurrentDraftId] = useState(null)
  const [currentDraft, setCurrentDraft] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [previewClassId, setPreviewClassId] = useState(undefined)
  const [activeTab, setActiveTab] = useState('overview')
  const [reloadTick, setReloadTick] = useState(0)
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [solveLoading, setSolveLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [dirty, setDirty] = useState(false)
  const pollingRef = useRef(null)

  const gradeOptions = useMemo(() => [...new Set(classes.map((item) => item.grade).filter(Boolean))].sort(compareGrade).map((item) => ({ label: item, value: item })), [classes])
  const summaryCounts = buildSummaryCounts({ plans, arrangements, teacherConstraints, locks })
  const configWarnings = buildConfigWarnings({ plans, arrangements, teacherConstraints, locks })
  const draftRows = buildTimetableRows(draftItems)
  const gradeClasses = classes.filter((item) => item.grade === grade)
  const classOptions = gradeClasses.map((item) => ({ label: `${item.grade}-${item.name}`, value: item.id }))
  const subjectOptions = subjects.map((item) => ({ label: item.name, value: item.id }))
  const teacherOptions = teachers.map((item) => ({ label: item.username, value: item.id }))
  const periodOptions = periods.map((item) => ({ label: item.name, value: item.id }))

  function markDirty() {
    setDirty(true)
  }

  function replaceRow(setter, index, patch) {
    setter((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)))
    markDirty()
  }

  function addRow(setter, factory) {
    setter((current) => [...current, factory()])
    markDirty()
  }

  function removeRow(setter, index, factory) {
    setter((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length ? next : [factory()]
    })
    markDirty()
  }

  useEffect(() => {
    let cancelled = false
    async function loadBootstrap() {
      setBootstrapLoading(true)
      try {
        const [classesResp, subjectsResp, teachersResp, periodsResp] = await Promise.all([getClasses(), getSubjects(), getScheduleTeachers(), getSchedulePeriods()])
        if (cancelled) return
        const nextClasses = classesResp.data || []
        setClasses(nextClasses)
        setSubjects(subjectsResp.data || [])
        setTeachers(teachersResp.data || [])
        setPeriods(periodsResp.data || [])
        if (!grade && nextClasses.length) setGrade([...new Set(nextClasses.map((item) => item.grade).filter(Boolean))].sort(compareGrade)[0] || '')
      } catch (error) {
        if (!cancelled) setPageError(error.message || '排课基础数据加载失败')
      } finally {
        if (!cancelled) setBootstrapLoading(false)
      }
    }
    loadBootstrap()
    return () => {
      cancelled = true
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  useEffect(() => {
    if (!grade) return
    let cancelled = false
    async function loadConfig() {
      setConfigLoading(true)
      try {
        const [plansResp, arrangementsResp, overridesResp, constraintsResp, locksResp] = await Promise.all([getLessonPlan(grade), getTeachingArrangement(grade), getLessonPlanOverrides(grade), getTeacherConstraints(grade), getTimetableLocks(grade)])
        if (cancelled) return
        setPlans(normalizePlans(plansResp.data?.items || []))
        setArrangements(normalizeArrangements(arrangementsResp.data?.items || []))
        setOverrides(normalizeOverrides(overridesResp.data?.items || []))
        setTeacherConstraints(normalizeTeacherConstraints(constraintsResp.data?.items || []))
        setLocks(normalizeLocks(locksResp.data?.items || []))
        setTask(null)
        setCurrentDraftId(null)
        setCurrentDraft(null)
        setDraftItems([])
        setPreviewRows([])
        setPreviewClassId(undefined)
        setDirty(false)
      } catch (error) {
        if (!cancelled) setPageError(error.message || '排课配置加载失败')
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    }
    loadConfig()
    return () => { cancelled = true }
  }, [grade, reloadTick])

  async function handleSaveAll() {
    if (!grade) return message.warning('请先选择年级')
    setSaveLoading(true)
    try {
      await Promise.all([
        saveLessonPlan({ grade, items: plans.filter((item) => item.subject_id).map((item) => ({ subject_id: item.subject_id, weekly_hours: Number(item.weekly_hours || 0), daily_max_hours: Number(item.daily_max_hours || 0), preferred_session: item.preferred_session || 'any', forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text) })) }),
        saveTeachingArrangement({ grade, items: arrangements.filter((item) => item.class_id && item.subject_id && item.teacher_id) }),
        saveLessonPlanOverrides({ grade, items: overrides.filter((item) => item.class_id && item.subject_id).map((item) => ({ class_id: item.class_id, subject_id: item.subject_id, weekly_hours: Number(item.weekly_hours || 0), daily_max_hours: Number(item.daily_max_hours || 0), preferred_session: item.preferred_session || 'any', forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text) })) }),
        saveTeacherConstraints({ grade, items: teacherConstraints.filter((item) => item.teacher_id).map((item) => ({ teacher_id: item.teacher_id, daily_max_hours: Number(item.daily_max_hours || 0), forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text), preferred_periods: parseForbiddenPeriods(item.preferred_periods_text) })) }),
        saveTimetableLocks({ grade, items: locks.filter((item) => item.class_id && item.subject_id && item.teacher_id && item.period_id).map((item) => ({ ...item, weekday: Number(item.weekday), period_id: Number(item.period_id), source: item.source || 'manual', note: item.note || '' })) }),
      ])
      setDirty(false)
      message.success('排课配置已保存')
    } catch (error) {
      message.error(error.message || '排课配置保存失败')
    } finally {
      setSaveLoading(false)
    }
  }

  async function loadDraftBundle(draftId) {
    const [draftResp, itemsResp] = await Promise.all([getScheduleDraft(draftId), getScheduleDraftItems(draftId)])
    setCurrentDraft(draftResp.data || null)
    setDraftItems(itemsResp.data?.items || [])
  }

  async function handleSolve() {
    if (!grade) return message.warning('请先选择年级')
    if (dirty) return message.warning('请先保存配置，再开始排课')
    if (pollingRef.current) clearInterval(pollingRef.current)
    setSolveLoading(true)
    setTask({ status: 'pending', progress: 0, message: '等待排课开始' })
    setCurrentDraftId(null)
    setCurrentDraft(null)
    setDraftItems([])
    setActiveTab('draft')
    try {
      const resp = await createAutoScheduleTask(grade)
      const taskId = resp.data?.task_id
      if (!taskId) throw new Error('未获取到排课任务 ID')
      pollingRef.current = setInterval(async () => {
        try {
          const taskResp = await getScheduleTask(taskId)
          const nextTask = taskResp.data || null
          setTask(nextTask)
          if (!nextTask || !['success', 'failed'].includes(nextTask.status)) return
          clearInterval(pollingRef.current)
          pollingRef.current = null
          setSolveLoading(false)
          if (nextTask.status === 'success' && nextTask.result?.draft_id) {
            setCurrentDraftId(nextTask.result.draft_id)
            await loadDraftBundle(nextTask.result.draft_id)
            message.success('排课完成，已生成当前草案')
          } else if (nextTask.status === 'failed') {
            message.error(nextTask.error || '排课失败')
          }
        } catch (error) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          setSolveLoading(false)
          message.error(error.message || '轮询排课任务失败')
        }
      }, 2000)
    } catch (error) {
      setSolveLoading(false)
      setTask({ status: 'failed', progress: 100, message: error.message, error: error.message })
      message.error(error.message || '创建排课任务失败')
    }
  }

  async function handlePublishDraft() {
    if (!currentDraftId) return message.warning('当前没有可发布的草案')
    setPublishLoading(true)
    try {
      await publishScheduleDraft(currentDraftId)
      message.success('草案已发布为正式课表')
      await loadDraftBundle(currentDraftId)
      if (previewClassId) {
        const resp = await getClassTimetable(previewClassId)
        setPreviewRows(buildTimetableRows(resp.data?.items || []))
      }
    } catch (error) {
      message.error(error.message || '发布草案失败')
    } finally {
      setPublishLoading(false)
    }
  }

  async function handlePreviewClass(classId) {
    setPreviewClassId(classId)
    if (!classId) return setPreviewRows([])
    try {
      const resp = await getClassTimetable(classId)
      setPreviewRows(buildTimetableRows(resp.data?.items || []))
    } catch (error) {
      message.error(error.message || '正式课表预览加载失败')
    }
  }

  const timetableColumns = [
    { title: '节次', dataIndex: 'periodLabel', key: 'periodLabel', width: 90, fixed: 'left' },
    { title: '周一', dataIndex: 'day_1', key: 'day_1' },
    { title: '周二', dataIndex: 'day_2', key: 'day_2' },
    { title: '周三', dataIndex: 'day_3', key: 'day_3' },
    { title: '周四', dataIndex: 'day_4', key: 'day_4' },
    { title: '周五', dataIndex: 'day_5', key: 'day_5' },
  ]

  const planColumns = [
    { title: '科目', dataIndex: 'subject_id', width: 160, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setPlans, index, { subject_id: value })} /> },
    { title: '周课时', dataIndex: 'weekly_hours', width: 100, render: (_, record, index) => <InputNumber min={0} max={30} style={{ width: '100%' }} value={record.weekly_hours} onChange={(value) => replaceRow(setPlans, index, { weekly_hours: value ?? 0 })} /> },
    { title: '每日上限', dataIndex: 'daily_max_hours', width: 100, render: (_, record, index) => <InputNumber min={0} max={10} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setPlans, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '偏好时段', dataIndex: 'preferred_session', width: 130, render: (_, record, index) => <Select value={record.preferred_session} options={SESSION_OPTIONS} onChange={(value) => replaceRow(setPlans, index, { preferred_session: value })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <Input placeholder="例如 1-1,5-3" value={record.forbidden_periods_text} onChange={(event) => replaceRow(setPlans, index, { forbidden_periods_text: event.target.value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setPlans, index, createEmptyPlan)}>删除</Button> },
  ]

  const arrangementColumns = [
    { title: '班级', dataIndex: 'class_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择班级" value={record.class_id} options={classOptions} onChange={(value) => replaceRow(setArrangements, index, { class_id: value })} /> },
    { title: '科目', dataIndex: 'subject_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setArrangements, index, { subject_id: value })} /> },
    { title: '教师', dataIndex: 'teacher_id', render: (_, record, index) => <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setArrangements, index, { teacher_id: value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setArrangements, index, createEmptyArrangement)}>删除</Button> },
  ]

  const overrideColumns = [
    { title: '班级', dataIndex: 'class_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择班级" value={record.class_id} options={classOptions} onChange={(value) => replaceRow(setOverrides, index, { class_id: value })} /> },
    { title: '科目', dataIndex: 'subject_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setOverrides, index, { subject_id: value })} /> },
    { title: '周课时', dataIndex: 'weekly_hours', width: 100, render: (_, record, index) => <InputNumber min={0} max={30} style={{ width: '100%' }} value={record.weekly_hours} onChange={(value) => replaceRow(setOverrides, index, { weekly_hours: value ?? 0 })} /> },
    { title: '每日上限', dataIndex: 'daily_max_hours', width: 100, render: (_, record, index) => <InputNumber min={0} max={10} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setOverrides, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '偏好时段', dataIndex: 'preferred_session', width: 130, render: (_, record, index) => <Select value={record.preferred_session} options={SESSION_OPTIONS} onChange={(value) => replaceRow(setOverrides, index, { preferred_session: value })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <Input placeholder="例如 2-1,4-3" value={record.forbidden_periods_text} onChange={(event) => replaceRow(setOverrides, index, { forbidden_periods_text: event.target.value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setOverrides, index, createEmptyOverride)}>删除</Button> },
  ]

  const teacherConstraintColumns = [
    { title: '教师', dataIndex: 'teacher_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setTeacherConstraints, index, { teacher_id: value })} /> },
    { title: '每日最大课时', dataIndex: 'daily_max_hours', width: 130, render: (_, record, index) => <InputNumber min={0} max={12} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setTeacherConstraints, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <Input placeholder="例如 1-2,3-4" value={record.forbidden_periods_text} onChange={(event) => replaceRow(setTeacherConstraints, index, { forbidden_periods_text: event.target.value })} /> },
    { title: '偏好时段', dataIndex: 'preferred_periods_text', render: (_, record, index) => <Input placeholder="例如 1-1,2-1" value={record.preferred_periods_text} onChange={(event) => replaceRow(setTeacherConstraints, index, { preferred_periods_text: event.target.value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setTeacherConstraints, index, createEmptyTeacherConstraint)}>删除</Button> },
  ]

  const lockColumns = [
    { title: '班级', dataIndex: 'class_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择班级" value={record.class_id} options={classOptions} onChange={(value) => replaceRow(setLocks, index, { class_id: value })} /> },
    { title: '科目', dataIndex: 'subject_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setLocks, index, { subject_id: value })} /> },
    { title: '教师', dataIndex: 'teacher_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setLocks, index, { teacher_id: value })} /> },
    { title: '星期', dataIndex: 'weekday', width: 110, render: (_, record, index) => <Select value={record.weekday} options={WEEKDAY_OPTIONS} onChange={(value) => replaceRow(setLocks, index, { weekday: value })} /> },
    { title: '节次', dataIndex: 'period_id', width: 120, render: (_, record, index) => <Select allowClear placeholder="选择节次" value={record.period_id} options={periodOptions} onChange={(value) => replaceRow(setLocks, index, { period_id: value })} /> },
    { title: '来源', dataIndex: 'source', width: 120, render: (_, record, index) => <Input value={record.source} onChange={(event) => replaceRow(setLocks, index, { source: event.target.value })} /> },
    { title: '备注', dataIndex: 'note', render: (_, record, index) => <Input placeholder="可选备注" value={record.note} onChange={(event) => replaceRow(setLocks, index, { note: event.target.value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setLocks, index, createEmptyLock)}>删除</Button> },
  ]

  if (bootstrapLoading) return <Spin spinning style={{ width: '100%' }} />

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col xs={24} lg={12}>
            <Title level={3} style={{ margin: 0 }}>排课管理</Title>
            <Text type="secondary">先集中配置参数，再保存并发起当前排课任务。</Text>
          </Col>
          <Col xs={24} lg={12}>
            <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Select style={{ minWidth: 180 }} placeholder="选择年级" value={grade || undefined} options={gradeOptions} onChange={setGrade} />
              <Button icon={<ReloadOutlined />} loading={configLoading} onClick={() => setReloadTick((value) => value + 1)}>刷新配置</Button>
              <Button icon={<SaveOutlined />} loading={saveLoading} type={dirty ? 'default' : 'primary'} onClick={handleSaveAll}>保存全部</Button>
              <Button icon={<RobotOutlined />} loading={solveLoading} type="primary" onClick={handleSolve}>开始排课</Button>
            </Space>
          </Col>
        </Row>
        {dirty ? <Alert style={{ marginTop: 16 }} type="warning" showIcon message="当前有未保存修改，请先保存后再开始排课。" /> : null}
      </Card>
      {pageError ? <Alert type="error" showIcon message={pageError} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}><Card size="small"><Statistic title="课时计划" value={summaryCounts.plans} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card size="small"><Statistic title="任课安排" value={summaryCounts.arrangements} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card size="small"><Statistic title="教师约束" value={summaryCounts.teacherConstraints} prefix={<SendOutlined />} /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card size="small"><Statistic title="锁定课时" value={summaryCounts.locks} prefix={<LockOutlined />} /></Card></Col>
      </Row>
      <Spin spinning={configLoading}>
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'overview',
                label: '配置总览',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {configWarnings.length ? (
                      <Alert type="warning" showIcon message="配置完整度提醒" description={configWarnings.join('；')} />
                    ) : (
                      <Alert type="success" showIcon message="当前年级已具备基础配置，可保存后发起排课。" />
                    )}
                    <Space wrap>
                      <Text>当前年级：{grade || '未选择'}</Text>
                      <Text>课时计划：{summaryCounts.plans}</Text>
                      <Text>任课安排：{summaryCounts.arrangements}</Text>
                      <Text>教师约束：{summaryCounts.teacherConstraints}</Text>
                      <Text>锁定课时：{summaryCounts.locks}</Text>
                    </Space>
                  </Space>
                ),
              },
              {
                key: 'plans',
                label: '课时计划',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Card size="small" title="年级基础课时规则" extra={<Button onClick={() => addRow(setPlans, createEmptyPlan)}>新增一行</Button>}>
                      <Table size="small" rowKey={(_, index) => `plan-${index}`} pagination={false} columns={planColumns} dataSource={plans} scroll={{ x: 860 }} />
                    </Card>
                    <Card size="small" title="班级课时覆写" extra={<Button onClick={() => addRow(setOverrides, createEmptyOverride)}>新增一行</Button>}>
                      <Table size="small" rowKey={(_, index) => `override-${index}`} pagination={false} columns={overrideColumns} dataSource={overrides} scroll={{ x: 960 }} />
                    </Card>
                  </Space>
                ),
              },
              {
                key: 'arrangements',
                label: '任课安排',
                children: (
                  <Card size="small" title="班级-科目-教师分配" extra={<Button onClick={() => addRow(setArrangements, createEmptyArrangement)}>新增一行</Button>}>
                    <Table size="small" rowKey={(_, index) => `arrangement-${index}`} pagination={false} columns={arrangementColumns} dataSource={arrangements} scroll={{ x: 760 }} />
                  </Card>
                ),
              },
              {
                key: 'constraints',
                label: '教师约束',
                children: (
                  <Card size="small" title="教师禁排与每日上限" extra={<Button onClick={() => addRow(setTeacherConstraints, createEmptyTeacherConstraint)}>新增一行</Button>}>
                    <Table size="small" rowKey={(_, index) => `constraint-${index}`} pagination={false} columns={teacherConstraintColumns} dataSource={teacherConstraints} scroll={{ x: 920 }} />
                  </Card>
                ),
              },
              {
                key: 'locks',
                label: '锁定课时',
                children: (
                  <Card size="small" title="固定不变的课时安排" extra={<Button onClick={() => addRow(setLocks, createEmptyLock)}>新增一行</Button>}>
                    <Table size="small" rowKey={(_, index) => `lock-${index}`} pagination={false} columns={lockColumns} dataSource={locks} scroll={{ x: 1180 }} />
                  </Card>
                ),
              },
              {
                key: 'draft',
                label: '排课草案',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Card size="small" title="当前任务">
                      {task ? (
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Text>{task.message || '任务进行中'}</Text>
                          <Progress percent={Number(task.progress || 0)} status={task.status === 'failed' ? 'exception' : undefined} />
                        </Space>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有任务记录。" />
                      )}
                    </Card>
                    <Card
                      size="small"
                      title="当前草案"
                      extra={<Button type="primary" loading={publishLoading} disabled={!currentDraftId} onClick={handlePublishDraft}>发布当前草案</Button>}
                    >
                      {currentDraft ? (
                        <Space direction="vertical" size={8}>
                          <Text>得分：{currentDraft.score ?? 0}</Text>
                          <Text>锁定命中：{currentDraft.summary?.locked_hits ?? 0}/{currentDraft.summary?.locked_total ?? 0}</Text>
                          <Text>风险数：{currentDraft.summary?.risk_count ?? 0}</Text>
                        </Space>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有草案，保存配置后可开始排课。" />
                      )}
                    </Card>
                    <Card size="small" title="草案课表">
                      {draftRows.length ? (
                        <Table size="small" rowKey="key" pagination={false} columns={timetableColumns} dataSource={draftRows} scroll={{ x: 900 }} />
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前草案明细为空。" />
                      )}
                    </Card>
                    <Card size="small" title="正式课表预览">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Select allowClear placeholder="选择班级查看正式课表" value={previewClassId} options={classOptions} onChange={handlePreviewClass} />
                        {previewRows.length ? (
                          <Table size="small" rowKey="key" pagination={false} columns={timetableColumns} dataSource={previewRows} scroll={{ x: 900 }} />
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前班级还没有正式课表。" />
                        )}
                      </Space>
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Spin>
    </Space>
  )
}

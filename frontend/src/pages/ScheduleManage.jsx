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
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  LockOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
  TableOutlined,
  ThunderboltOutlined,
  WarningOutlined,
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
import {
  buildConfigWarnings,
  buildSummaryCounts,
  buildTaskSnapshot,
  buildTimetableRows,
  formatForbiddenPeriods,
  parseForbiddenPeriods,
} from './scheduleManageUtils'

const { Title, Text, Paragraph } = Typography

const SESSION_OPTIONS = [
  { label: '不限', value: 'any' },
  { label: '优先上午', value: 'morning_prefer' },
  { label: '优先下午', value: 'afternoon_prefer' },
]

const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
]

const GRADE_RANK = {
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

const pageTokens = {
  pageBg: 'linear-gradient(180deg, #f4f8fc 0%, #edf3fb 50%, #f7f9fc 100%)',
  heroBg: 'linear-gradient(135deg, #0f2749 0%, #163865 44%, #215083 100%)',
  heroGlow: 'radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 42%)',
  heroGlowSoft: 'radial-gradient(circle at bottom left, rgba(255,197,91,0.18), transparent 34%)',
  cardBg: 'rgba(255,255,255,0.88)',
  cardBorder: '1px solid rgba(159, 182, 210, 0.28)',
  panelShadow: '0 24px 60px rgba(15, 39, 73, 0.08)',
  sectionShadow: '0 16px 40px rgba(15, 39, 73, 0.06)',
  primary: '#145fc6',
  ink: '#10243e',
  muted: '#5f728c',
  success: '#18794e',
  warning: '#b76c07',
  danger: '#c4532c',
}

const createEmptyPlan = () => ({ subject_id: undefined, weekly_hours: 2, daily_max_hours: 1, preferred_session: 'any', forbidden_periods_text: '' })
const createEmptyArrangement = () => ({ class_id: undefined, subject_id: undefined, teacher_id: undefined })
const createEmptyOverride = () => ({ class_id: undefined, subject_id: undefined, weekly_hours: 2, daily_max_hours: 1, preferred_session: 'any', forbidden_periods_text: '' })
const createEmptyTeacherConstraint = () => ({ teacher_id: undefined, daily_max_hours: 4, forbidden_periods_text: '', preferred_periods_text: '' })
const createEmptyLock = () => ({ class_id: undefined, subject_id: undefined, teacher_id: undefined, weekday: 1, period_id: undefined, source: 'manual', note: '' })

const compareGrade = (left, right) =>
  (GRADE_RANK[left] ?? 999) - (GRADE_RANK[right] ?? 999) || String(left).localeCompare(String(right), 'zh-Hans-CN')

const normalizePlans = (items) =>
  (items.length ? items : [createEmptyPlan()]).map((item) => ({
    ...item,
    forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods),
  }))

const normalizeOverrides = (items) =>
  (items.length ? items : [createEmptyOverride()]).map((item) => ({
    ...item,
    forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods),
  }))

const normalizeTeacherConstraints = (items) =>
  (items.length ? items : [createEmptyTeacherConstraint()]).map((item) => ({
    ...item,
    forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods),
    preferred_periods_text: formatForbiddenPeriods(item.preferred_periods),
  }))

const normalizeArrangements = (items) => (items.length ? items : [createEmptyArrangement()])
const normalizeLocks = (items) => (items.length ? items : [createEmptyLock()])

function getToneTagProps(tone) {
  if (tone === 'success') return { color: 'success', label: '草案就绪' }
  if (tone === 'processing') return { color: 'processing', label: '求解中' }
  if (tone === 'danger') return { color: 'error', label: '任务异常' }
  return { color: 'default', label: '未启动' }
}

function MetricCard({ icon, label, value, helper, accent }) {
  return (
    <Card style={{ height: '100%', borderRadius: 22, border: pageTokens.cardBorder, background: pageTokens.cardBg, boxShadow: pageTokens.sectionShadow }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: accent.background, color: accent.color, fontSize: 18 }}>
          {icon}
        </div>
        <Space direction="vertical" size={2}>
          <Text style={{ color: pageTokens.muted, fontSize: 13 }}>{label}</Text>
          <Text style={{ color: pageTokens.ink, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{value}</Text>
        </Space>
        <Text style={{ color: pageTokens.muted, fontSize: 12 }}>{helper}</Text>
      </Space>
    </Card>
  )
}

function OverviewJumpCard({ title, description, metric, onOpen }) {
  return (
    <Card hoverable onClick={onOpen} style={{ height: '100%', cursor: 'pointer', borderRadius: 20, border: '1px solid rgba(177, 195, 219, 0.42)', background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,250,255,0.96) 100%)', boxShadow: '0 12px 28px rgba(15, 39, 73, 0.05)' }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Text style={{ color: pageTokens.ink, fontSize: 16, fontWeight: 600 }}>{title}</Text>
          <Tag color="blue">{metric}</Tag>
        </Space>
        <Text style={{ color: pageTokens.muted, minHeight: 44 }}>{description}</Text>
        <Button type="link" style={{ padding: 0 }} onClick={onOpen}>进入模块</Button>
      </Space>
    </Card>
  )
}

function ReviewStatCard({ title, value, helper }) {
  return (
    <div style={{ padding: 16, borderRadius: 18, background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,248,255,0.92) 100%)', border: '1px solid rgba(177, 195, 219, 0.42)' }}>
      <Text style={{ color: pageTokens.muted, fontSize: 12 }}>{title}</Text>
      <div style={{ marginTop: 8, color: pageTokens.ink, fontSize: 24, fontWeight: 700 }}>{value}</div>
      <Text style={{ color: pageTokens.muted, fontSize: 12 }}>{helper}</Text>
    </div>
  )
}

function SectionCard({ eyebrow, title, description, extra, children }) {
  return (
    <Card style={{ borderRadius: 24, border: pageTokens.cardBorder, background: pageTokens.cardBg, boxShadow: pageTokens.sectionShadow }}>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={extra ? 16 : 24}>
            <Space direction="vertical" size={4}>
              {eyebrow ? <Text style={{ color: pageTokens.primary, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{eyebrow}</Text> : null}
              <Title level={4} style={{ margin: 0, color: pageTokens.ink }}>{title}</Title>
              {description ? <Text style={{ color: pageTokens.muted }}>{description}</Text> : null}
            </Space>
          </Col>
          {extra ? <Col xs={24} md={8}><div style={{ display: 'flex', justifyContent: 'flex-end' }}>{extra}</div></Col> : null}
        </Row>
        {children}
      </Space>
    </Card>
  )
}

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

  const gradeOptions = useMemo(
    () =>
      [...new Set(classes.map((item) => item.grade).filter(Boolean))]
        .sort(compareGrade)
        .map((item) => ({ label: item, value: item })),
    [classes],
  )

  const summaryCounts = buildSummaryCounts({ plans, arrangements, overrides, teacherConstraints, locks })
  const configWarnings = buildConfigWarnings({ plans, arrangements, dirty })
  const taskSnapshot = buildTaskSnapshot({ task, currentDraft, draftItems })
  const draftRows = buildTimetableRows(draftItems)
  const gradeClasses = classes.filter((item) => item.grade === grade)
  const classOptions = gradeClasses.map((item) => ({ label: `${item.grade}-${item.name}`, value: item.id }))
  const subjectOptions = subjects.map((item) => ({ label: item.name, value: item.id }))
  const teacherOptions = teachers.map((item) => ({ label: item.username, value: item.id }))
  const periodOptions = periods.map((item) => ({ label: item.name, value: item.id }))

  const readinessPercent = useMemo(() => {
    const checkpoints = [Boolean(grade), summaryCounts.plans > 0, summaryCounts.arrangements > 0, !dirty]
    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100)
  }, [dirty, grade, summaryCounts.arrangements, summaryCounts.plans])

  const nextAction = useMemo(() => {
    if (!grade) {
      return {
        title: '先锁定一个年级',
        description: '所有配置、草案和预览都以年级为单位组织，先选择目标年级再继续。',
        tab: 'overview',
      }
    }
    if (!summaryCounts.plans) {
      return {
        title: '补齐课时计划',
        description: '先定义每个学科的周课时、单日上限和禁排时段，求解器才能建立基础规则。',
        tab: 'plans',
      }
    }
    if (!summaryCounts.arrangements) {
      return {
        title: '补齐任课安排',
        description: '把班级、学科和教师的对应关系补齐后，自动排课才能生成有效草案。',
        tab: 'arrangements',
      }
    }
    if (dirty) {
      return {
        title: '保存当前调整',
        description: '当前存在未保存的修改，先保存，再发起排课任务。',
        tab: activeTab,
      }
    }
    if (!currentDraft) {
      return {
        title: '开始自动排课',
        description: '核心条件已经具备，可以立即启动当前年级的 CP-SAT 求解任务。',
        tab: 'draft',
      }
    }
    return {
      title: '复核并发布当前草案',
      description: '草案已生成，建议先检查锁定命中率、风险数和正式课表预览，再决定是否发布。',
      tab: 'draft',
    }
  }, [activeTab, currentDraft, dirty, grade, summaryCounts.arrangements, summaryCounts.plans])

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
      setPageError('')
      try {
        const [classesResp, subjectsResp, teachersResp, periodsResp] = await Promise.all([
          getClasses(),
          getSubjects(),
          getScheduleTeachers(),
          getSchedulePeriods(),
        ])
        if (cancelled) return

        const nextClasses = classesResp.data || []
        setClasses(nextClasses)
        setSubjects(subjectsResp.data || [])
        setTeachers(teachersResp.data || [])
        setPeriods(periodsResp.data || [])

        if (nextClasses.length) {
          const defaultGrade = [...new Set(nextClasses.map((item) => item.grade).filter(Boolean))].sort(compareGrade)[0] || ''
          setGrade((current) => current || defaultGrade)
        }
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
      setPageError('')
      try {
        const [plansResp, arrangementsResp, overridesResp, constraintsResp, locksResp] = await Promise.all([
          getLessonPlan(grade),
          getTeachingArrangement(grade),
          getLessonPlanOverrides(grade),
          getTeacherConstraints(grade),
          getTimetableLocks(grade),
        ])
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

    return () => {
      cancelled = true
    }
  }, [grade, reloadTick])

  async function handleSaveAll() {
    if (!grade) return message.warning('请先选择年级')

    setSaveLoading(true)
    try {
      await Promise.all([
        saveLessonPlan({
          grade,
          items: plans
            .filter((item) => item.subject_id)
            .map((item) => ({
              subject_id: item.subject_id,
              weekly_hours: Number(item.weekly_hours || 0),
              daily_max_hours: Number(item.daily_max_hours || 0),
              preferred_session: item.preferred_session || 'any',
              forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text),
            })),
        }),
        saveTeachingArrangement({
          grade,
          items: arrangements.filter((item) => item.class_id && item.subject_id && item.teacher_id),
        }),
        saveLessonPlanOverrides({
          grade,
          items: overrides
            .filter((item) => item.class_id && item.subject_id)
            .map((item) => ({
              class_id: item.class_id,
              subject_id: item.subject_id,
              weekly_hours: Number(item.weekly_hours || 0),
              daily_max_hours: Number(item.daily_max_hours || 0),
              preferred_session: item.preferred_session || 'any',
              forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text),
            })),
        }),
        saveTeacherConstraints({
          grade,
          items: teacherConstraints
            .filter((item) => item.teacher_id)
            .map((item) => ({
              teacher_id: item.teacher_id,
              daily_max_hours: Number(item.daily_max_hours || 0),
              forbidden_periods: parseForbiddenPeriods(item.forbidden_periods_text),
              preferred_periods: parseForbiddenPeriods(item.preferred_periods_text),
            })),
        }),
        saveTimetableLocks({
          grade,
          items: locks
            .filter((item) => item.class_id && item.subject_id && item.teacher_id && item.period_id)
            .map((item) => ({
              ...item,
              weekday: Number(item.weekday),
              period_id: Number(item.period_id),
              source: item.source || 'manual',
              note: item.note || '',
            })),
        }),
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
    setTask({ status: 'pending', progress: 0, message: '排课引擎准备启动中' })
    setCurrentDraftId(null)
    setCurrentDraft(null)
    setDraftItems([])
    setActiveTab('draft')

    try {
      const response = await createAutoScheduleTask(grade)
      const taskId = response.data?.task_id
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
        const response = await getClassTimetable(previewClassId)
        setPreviewRows(buildTimetableRows(response.data?.items || []))
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
      const response = await getClassTimetable(classId)
      setPreviewRows(buildTimetableRows(response.data?.items || []))
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
    { title: '科目', dataIndex: 'subject_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setPlans, index, { subject_id: value })} /> },
    { title: '周课时', dataIndex: 'weekly_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={30} style={{ width: '100%' }} value={record.weekly_hours} onChange={(value) => replaceRow(setPlans, index, { weekly_hours: value ?? 0 })} /> },
    { title: '单日上限', dataIndex: 'daily_max_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={10} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setPlans, index, { daily_max_hours: value ?? 0 })} /> },
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
    { title: '周课时', dataIndex: 'weekly_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={30} style={{ width: '100%' }} value={record.weekly_hours} onChange={(value) => replaceRow(setOverrides, index, { weekly_hours: value ?? 0 })} /> },
    { title: '单日上限', dataIndex: 'daily_max_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={10} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setOverrides, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '偏好时段', dataIndex: 'preferred_session', width: 130, render: (_, record, index) => <Select value={record.preferred_session} options={SESSION_OPTIONS} onChange={(value) => replaceRow(setOverrides, index, { preferred_session: value })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <Input placeholder="例如 2-1,4-3" value={record.forbidden_periods_text} onChange={(event) => replaceRow(setOverrides, index, { forbidden_periods_text: event.target.value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setOverrides, index, createEmptyOverride)}>删除</Button> },
  ]

  const teacherConstraintColumns = [
    { title: '教师', dataIndex: 'teacher_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setTeacherConstraints, index, { teacher_id: value })} /> },
    { title: '单日最大课时', dataIndex: 'daily_max_hours', width: 130, render: (_, record, index) => <InputNumber min={0} max={12} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setTeacherConstraints, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <Input placeholder="例如 1-2,3-4" value={record.forbidden_periods_text} onChange={(event) => replaceRow(setTeacherConstraints, index, { forbidden_periods_text: event.target.value })} /> },
    { title: '优先时段', dataIndex: 'preferred_periods_text', render: (_, record, index) => <Input placeholder="例如 1-1,2-1" value={record.preferred_periods_text} onChange={(event) => replaceRow(setTeacherConstraints, index, { preferred_periods_text: event.target.value })} /> },
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

  const overviewItems = [
    { key: 'plans', title: '课时计划', metric: `${summaryCounts.plans} 条`, description: '配置学科周课时、单日上限、偏好时段和禁排时段。' },
    { key: 'arrangements', title: '任课安排', metric: `${summaryCounts.arrangements} 条`, description: '明确班级、科目与教师的映射关系，是排课求解的核心输入。' },
    { key: 'constraints', title: '教师约束', metric: `${summaryCounts.teacherConstraints} 条`, description: '限制教师每日最大课时，并为特殊教师配置优先或禁排时段。' },
    { key: 'locks', title: '锁定课位', metric: `${summaryCounts.locks} 条`, description: '固定不允许变化的课位，用于保留行政班会或特定联排场景。' },
  ]

  const tabItems = [
    {
      key: 'overview',
      label: <Space size={6}><span>总览</span><Tag bordered={false} color="blue">快速配置</Tag></Space>,
      children: (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Alert type={configWarnings.length ? 'warning' : 'success'} showIcon message={configWarnings.length ? '当前还有核心配置待完善' : '当前年级已具备基础排课条件'} description={configWarnings.length ? configWarnings.join('，') : '建议继续检查教师约束、锁定课位和正式课表预览，再发起当前草案。'} />
          <Row gutter={[16, 16]}>
            {overviewItems.map((item) => (
              <Col xs={24} md={12} key={item.key}>
                <OverviewJumpCard title={item.title} description={item.description} metric={item.metric} onOpen={() => setActiveTab(item.key)} />
              </Col>
            ))}
          </Row>
          <SectionCard eyebrow="WORKSPACE INSIGHT" title="配置推进建议" description="把高频基础配置放在前面，高级约束在基础数据稳定后补齐。">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}><ReviewStatCard title="班级范围" value={gradeClasses.length} helper="当前年级班级数" /></Col>
              <Col xs={24} md={8}><ReviewStatCard title="课程覆盖" value={summaryCounts.overrides} helper="班级个性化覆盖条目" /></Col>
              <Col xs={24} md={8}><ReviewStatCard title="节次模板" value={periods.length} helper="可用节次数量" /></Col>
            </Row>
          </SectionCard>
        </Space>
      ),
    },
    {
      key: 'plans',
      label: <Space size={6}><span>课时计划</span><Tag bordered={false}>{summaryCounts.plans}</Tag></Space>,
      children: (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <SectionCard eyebrow="BASE RULES" title="年级基础课时规则" description="这里定义年级通用的课时规则，是求解器的第一层约束。" extra={<Button onClick={() => addRow(setPlans, createEmptyPlan)}>新增规则</Button>}>
            <Table size="middle" rowKey={(_, index) => `plan-${index}`} pagination={false} columns={planColumns} dataSource={plans} scroll={{ x: 920 }} />
          </SectionCard>
          <SectionCard eyebrow="CLASS OVERRIDES" title="班级课时覆盖" description="当某个班级需要特殊安排时，在这里覆盖基础规则，不影响其他班级。" extra={<Button onClick={() => addRow(setOverrides, createEmptyOverride)}>新增覆盖</Button>}>
            <Table size="middle" rowKey={(_, index) => `override-${index}`} pagination={false} columns={overrideColumns} dataSource={overrides} scroll={{ x: 1020 }} />
          </SectionCard>
        </Space>
      ),
    },
    {
      key: 'arrangements',
      label: <Space size={6}><span>任课安排</span><Tag bordered={false}>{summaryCounts.arrangements}</Tag></Space>,
      children: (
        <SectionCard eyebrow="TEACHING MAP" title="班级-科目-教师分配" description="自动排课前，先把授课关系梳理清楚。这里越完整，草案越稳定。" extra={<Button onClick={() => addRow(setArrangements, createEmptyArrangement)}>新增安排</Button>}>
          <Table size="middle" rowKey={(_, index) => `arrangement-${index}`} pagination={false} columns={arrangementColumns} dataSource={arrangements} scroll={{ x: 780 }} />
        </SectionCard>
      ),
    },
    {
      key: 'constraints',
      label: <Space size={6}><span>教师约束</span><Tag bordered={false}>{summaryCounts.teacherConstraints}</Tag></Space>,
      children: (
        <SectionCard eyebrow="TEACHER CONSTRAINTS" title="教师禁排与优先时段" description="用于处理教师个人时间、兼课安排和每日最大课时限制。" extra={<Button onClick={() => addRow(setTeacherConstraints, createEmptyTeacherConstraint)}>新增约束</Button>}>
          <Table size="middle" rowKey={(_, index) => `constraint-${index}`} pagination={false} columns={teacherConstraintColumns} dataSource={teacherConstraints} scroll={{ x: 980 }} />
        </SectionCard>
      ),
    },
    {
      key: 'locks',
      label: <Space size={6}><span>锁定课位</span><Tag bordered={false}>{summaryCounts.locks}</Tag></Space>,
      children: (
        <SectionCard eyebrow="LOCKED SLOTS" title="固定不变的课位" description="用于提前锁定行政班会、公共课程或必须保留的课位。" extra={<Button onClick={() => addRow(setLocks, createEmptyLock)}>新增锁定</Button>}>
          <Table size="middle" rowKey={(_, index) => `lock-${index}`} pagination={false} columns={lockColumns} dataSource={locks} scroll={{ x: 1220 }} />
        </SectionCard>
      ),
    },
  ]

  const taskTag = getToneTagProps(taskSnapshot.tone)
  const currentDraftScore = currentDraft?.score ?? '--'
  const lockedHits = currentDraft?.summary?.locked_hits ?? 0
  const lockedTotal = currentDraft?.summary?.locked_total ?? 0
  const riskCount = currentDraft?.summary?.risk_count ?? 0

  if (bootstrapLoading) {
    return (
      <div style={{ minHeight: '56vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="正在加载排课工作台..." />
      </div>
    )
  }

  return (
    <div style={{ margin: -24, padding: 24, background: pageTokens.pageBg, minHeight: 'calc(100vh - 112px)' }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 28, background: `${pageTokens.heroGlow}, ${pageTokens.heroGlowSoft}, ${pageTokens.heroBg}`, boxShadow: pageTokens.panelShadow }}>
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} xl={14}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="gold" style={{ borderRadius: 999, paddingInline: 12 }}>排课指挥台</Tag>
                  <Tag color={taskTag.color} style={{ borderRadius: 999, paddingInline: 12 }}>{taskTag.label}</Tag>
                  <Tag color={dirty ? 'warning' : 'default'} style={{ borderRadius: 999, paddingInline: 12 }}>{dirty ? '存在未保存修改' : '配置已同步'}</Tag>
                </Space>
                <div>
                  <Title level={2} style={{ margin: 0, color: '#ffffff' }}>排课管理</Title>
                  <Paragraph style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 15, maxWidth: 720 }}>
                    将课时规则、任课安排与约束信息集中在一个高密度控制台里，先判断当前年级是否具备求解条件，再发起自动排课并复核当前草案。
                  </Paragraph>
                </div>
                <Space wrap size={[8, 8]}>
                  <Tag bordered={false} style={{ borderRadius: 999, padding: '6px 12px', color: '#dbe8ff', background: 'rgba(255,255,255,0.12)' }}>当前年级：{grade || '未选择'}</Tag>
                  <Tag bordered={false} style={{ borderRadius: 999, padding: '6px 12px', color: '#dbe8ff', background: 'rgba(255,255,255,0.12)' }}>配置完成度：{readinessPercent}%</Tag>
                  <Tag bordered={false} style={{ borderRadius: 999, padding: '6px 12px', color: '#dbe8ff', background: 'rgba(255,255,255,0.12)' }}>当前草案得分：{currentDraftScore}</Tag>
                </Space>
              </Space>
            </Col>
            <Col xs={24} xl={10}>
              <div style={{ borderRadius: 24, padding: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text style={{ color: 'rgba(255,255,255,0.72)', display: 'block', marginBottom: 8 }}>快速操作</Text>
                    <Select style={{ width: '100%' }} placeholder="选择年级" value={grade || undefined} options={gradeOptions} onChange={setGrade} />
                  </div>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12}><Button block icon={<ReloadOutlined />} loading={configLoading} onClick={() => setReloadTick((value) => value + 1)}>刷新配置</Button></Col>
                    <Col xs={24} sm={12}><Button block icon={<SaveOutlined />} loading={saveLoading} type="primary"  onClick={handleSaveAll}>保存全部</Button></Col>
                    <Col xs={24}><Button block size="large" type="primary" icon={<RobotOutlined />} loading={solveLoading} onClick={handleSolve}>开始自动排课</Button></Col>
                  </Row>
                  <div style={{ borderRadius: 18, padding: 14, background: 'rgba(7, 18, 34, 0.26)', color: '#ffffff' }}>
                    <Text style={{ display: 'block', color: 'rgba(255,255,255,0.72)', marginBottom: 6 }}>推荐下一步</Text>
                    <Text style={{ display: 'block', color: '#ffffff', fontWeight: 600 }}>{nextAction.title}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.72)' }}>{nextAction.description}</Text>
                  </div>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        {pageError ? <Alert type="error" showIcon message={pageError} /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}><MetricCard icon={<ClockCircleOutlined />} label="课时计划" value={summaryCounts.plans} helper="已配置的年级课时规则" accent={{ background: '#e9f2ff', color: '#145fc6' }} /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard icon={<CheckCircleOutlined />} label="任课安排" value={summaryCounts.arrangements} helper="已完成的班级-学科-教师绑定" accent={{ background: '#eaf7ef', color: '#18794e' }} /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard icon={<SendOutlined />} label="教师约束" value={summaryCounts.teacherConstraints} helper="教师个人时间约束条目" accent={{ background: '#fff5e6', color: '#b76c07' }} /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard icon={<LockOutlined />} label="锁定课位" value={summaryCounts.locks} helper="不允许求解器改变的课位" accent={{ background: '#fceeea', color: '#c4532c' }} /></Col>
        </Row>
        <SectionCard eyebrow="CONTROL NOTES" title="控制台提示" description="帮助教务老师在高频操作时快速定位关键入口。">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space align="start" size={10}><AppstoreOutlined style={{ color: pageTokens.primary, marginTop: 4 }} /><Text style={{ color: pageTokens.muted }}>第一步：快速操作，选择年级，刷新配置进行加载已保存的排课配置(没保存过没有数据)</Text></Space>
            <Space align="start" size={10}><AppstoreOutlined style={{ color: pageTokens.primary, marginTop: 4 }} /><Text style={{ color: pageTokens.muted }}>第二步：在排课配置工作区配置核心规则：课时计划和任课安排是自动排课的核心输入，建议优先完成。教师约束和锁定课位属于精细化控制，可在基础配置稳定后逐步补齐。</Text></Space>
            <Space align="start" size={10}><AppstoreOutlined style={{ color: pageTokens.primary, marginTop: 4 }} /><Text style={{ color: pageTokens.muted }}>第三步：核心规则配置完成后建议点击快速操作中的保存全部。</Text></Space>
            <Space align="start" size={10}><EyeOutlined style={{ color: pageTokens.success, marginTop: 4 }} /><Text style={{ color: pageTokens.muted }}>第四步：生成草案后，发布前建议对照“当前草案课表”和“正式课表预览”，避免误覆盖已发布结果。</Text></Space>
            <Space align="start" size={10}><TableOutlined style={{ color: pageTokens.danger, marginTop: 4 }} /><Text style={{ color: pageTokens.muted }}>第五步：发布当前草案，课表生成。</Text></Space>
            </Space>
        </SectionCard>
        <Spin spinning={configLoading}>
          <Row gutter={[20, 20]} align="top">
            <Col xs={24} xl={16}>
              <SectionCard eyebrow="CONFIGURATION WORKSPACE" title="排课配置工作区" description="先配置核心规则，再补充高级约束。左侧负责输入，右侧负责复核当前草案与正式课表。">
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
              </SectionCard>
            </Col>
            <Col xs={24} xl={8}>
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <SectionCard
                  eyebrow="DRAFT REVIEW"
                  title="当前任务与草案"
                  description="这里只展示当前任务生成的草案，不虚构历史时间线。"
                  extra={<Button type="primary" icon={<SendOutlined />} loading={publishLoading} disabled={!currentDraftId || !taskSnapshot.readyToPublish} onClick={handlePublishDraft}>发布当前草案</Button>}
                >
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div style={{ borderRadius: 20, padding: 18, background: taskSnapshot.tone === 'success' ? 'linear-gradient(180deg, rgba(234,247,239,0.9) 0%, rgba(255,255,255,0.95) 100%)' : taskSnapshot.tone === 'danger' ? 'linear-gradient(180deg, rgba(252,238,234,0.95) 0%, rgba(255,255,255,0.95) 100%)' : 'linear-gradient(180deg, rgba(234,243,255,0.92) 0%, rgba(255,255,255,0.95) 100%)', border: '1px solid rgba(177, 195, 219, 0.42)' }}>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Text style={{ color: pageTokens.ink, fontWeight: 700 }}>{taskSnapshot.title}</Text>
                          <Tag color={taskTag.color}>{taskTag.label}</Tag>
                        </Space>
                        <Text style={{ color: pageTokens.muted }}>{taskSnapshot.description}</Text>
                        <Progress percent={Number(taskSnapshot.progress || 0)} status={taskSnapshot.tone === 'danger' ? 'exception' : undefined} strokeColor={taskSnapshot.tone === 'success' ? pageTokens.success : pageTokens.primary} />
                      </Space>
                    </div>
                    <Row gutter={[12, 12]}>
                      <Col span={12}><ReviewStatCard title="草案得分" value={currentDraftScore} helper="当前草案质量评分" /></Col>
                      <Col span={12}><ReviewStatCard title="风险数" value={riskCount} helper="待复核风险条目" /></Col>
                      <Col span={12}><ReviewStatCard title="锁定命中" value={`${lockedHits}/${lockedTotal}`} helper="锁定规则满足情况" /></Col>
                      <Col span={12}><ReviewStatCard title="草案课位" value={draftItems.length} helper="已生成课位数量" /></Col>
                    </Row>
                  </Space>
                </SectionCard>

                <SectionCard eyebrow="READINESS" title="排课准备度" description="帮助你判断现在更适合继续配置、保存修改，还是直接发起求解。">
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Progress percent={readinessPercent} strokeColor={readinessPercent >= 100 ? pageTokens.success : pageTokens.primary} />
                    {configWarnings.length ? <Alert type="warning" showIcon message="还有核心项待完成" description={configWarnings.join('，')} /> : <Alert type="success" showIcon message="当前核心配置已完成" description={dirty ? '建议先保存本轮修改，再发起自动排课。' : '可以直接启动自动排课，或继续补充高级约束。'} />}
                    <div style={{ borderRadius: 18, padding: 16, background: 'linear-gradient(180deg, rgba(246,249,253,0.98) 0%, rgba(255,255,255,0.95) 100%)', border: '1px solid rgba(177, 195, 219, 0.35)' }}>
                      <Space align="start" size={12}>
                        <ThunderboltOutlined style={{ color: pageTokens.primary, fontSize: 18, marginTop: 2 }} />
                        <Space direction="vertical" size={4}>
                          <Text style={{ color: pageTokens.ink, fontWeight: 600 }}>{nextAction.title}</Text>
                          <Text style={{ color: pageTokens.muted }}>{nextAction.description}</Text>
                          <Button type="link" style={{ padding: 0 }} onClick={() => setActiveTab(nextAction.tab)}>打开对应模块</Button>
                        </Space>
                      </Space>
                    </div>
                  </Space>
                </SectionCard>

                <SectionCard eyebrow="DRAFT TIMETABLE" title="当前草案课表" description="用于检查求解器刚生成的结果是否符合预期。">
                  {draftRows.length ? <Table size="small" rowKey="key" pagination={false} columns={timetableColumns} dataSource={draftRows} scroll={{ x: 900 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有草案课表，保存配置后即可开始排课。" />}
                </SectionCard>

                <SectionCard eyebrow="PUBLISHED PREVIEW" title="正式课表预览" description="按班级查看当前已经发布的正式课表，用于对比草案与最终结果。">
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Select allowClear placeholder="选择班级查看正式课表" value={previewClassId} options={classOptions} onChange={handlePreviewClass} />
                    {previewRows.length ? <Table size="small" rowKey="key" pagination={false} columns={timetableColumns} dataSource={previewRows} scroll={{ x: 900 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前班级还没有可展示的正式课表。" />}
                  </Space>
                </SectionCard>

                
              </Space>
            </Col>
          </Row>
        </Spin>
      </Space>
    </div>
  )
}

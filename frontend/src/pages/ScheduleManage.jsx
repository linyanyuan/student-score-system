import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  LockOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
  TableOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { getClasses } from '../api/class'
import { getSchedulePeriods } from '../api/schedule'
import { getSubjects } from '../api/subject'
import {
  createAutoScheduleTask,
  createScheduleImport,
  createScheduleImportDraft,
  downloadScheduleImportTemplate,
  exportScheduleDraft,
  exportScheduleDebugConfig,
  getClassTimetable,
  getLessonPlan,
  getLessonPlanOverrides,
  getPeriodPlan,
  getScheduleDraft,
  getScheduleDraftItems,
  getScheduleTask,
  getScheduleTeachers,
  getScheduleImportItems,
  getTeacherConstraints,
  getTeachingArrangement,
  getTimetableLocks,
  patchScheduleImportItem,
  publishScheduleDraft,
  saveLessonPlan,
  saveLessonPlanOverrides,
  savePeriodPlan,
  saveTeacherConstraints,
  saveTeachingArrangement,
  saveTimetableLocks,
} from '../api/scheduling'
import {
  buildConfigWarnings,
  buildSummaryCounts,
  buildTaskSnapshot,
  buildTimetableRows,
  canCreateImportDraft,
  filterImportItemsByStatus,
  formatForbiddenPeriods,
  parseForbiddenPeriods,
  summarizeImportIssues,
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

const IMPORT_STEPS = [
  { title: '选择范围' },
  { title: '上传文件' },
  { title: '识别核对' },
  { title: '生成草案' },
]

const IMPORT_SCOPE_OPTIONS = [
  { label: '年级总课表', value: 'grade' },
  { label: '单班课表', value: 'class' },
]

const IMPORT_FLAG_LABELS = {
  unrecognized_subject: { color: 'error', label: '未识别科目' },
  teacher_unmatched: { color: 'error', label: '未匹配教师' },
  teacher_ambiguous: { color: 'warning', label: '教师待确认' },
  teacher_time_conflict: { color: 'error', label: '教师时间冲突' },
}

const IMPORT_STATUS_FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'unresolved' },
  { label: '未识别科目', value: 'unrecognized_subject' },
  { label: '未匹配教师', value: 'teacher_unmatched' },
  { label: '教师待确认', value: 'teacher_ambiguous' },
  { label: '教师时间冲突', value: 'teacher_time_conflict' },
  { label: '已匹配', value: 'matched' },
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

function WorkflowTaskTile({ title, helper, status, detail, optional = false, actionLabel, onAction }) {
  const statusTone = status === 'done'
    ? { background: 'rgba(24, 121, 78, 0.1)', color: pageTokens.success, label: '已完成' }
    : optional
      ? { background: 'rgba(183, 108, 7, 0.1)', color: pageTokens.warning, label: '可选优化' }
      : { background: 'rgba(196, 83, 44, 0.1)', color: pageTokens.danger, label: '待完成' }

  return (
    <div style={{ padding: 18, borderRadius: 20, border: '1px solid rgba(177, 195, 219, 0.42)', background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,250,255,0.96) 100%)' }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Text style={{ color: pageTokens.ink, fontSize: 16, fontWeight: 600 }}>{title}</Text>
          <Tag bordered={false} style={{ borderRadius: 999, background: statusTone.background, color: statusTone.color }}>{statusTone.label}</Tag>
        </Space>
        <Text style={{ color: pageTokens.muted }}>{helper}</Text>
        <Text style={{ color: pageTokens.ink, minHeight: 22 }}>{detail}</Text>
        <Button type="link" style={{ padding: 0 }} onClick={onAction}>{actionLabel}</Button>
      </Space>
    </div>
  )
}

function ImportIssueTags({ flags = [] }) {
  if (!flags.length) return <Tag color="success">已匹配</Tag>
  return (
    <Space size={[4, 4]} wrap>
      {flags.map((flag) => {
        const config = IMPORT_FLAG_LABELS[flag] || { color: 'default', label: flag }
        return <Tag key={flag} color={config.color}>{config.label}</Tag>
      })}
    </Space>
  )
}

function ForbiddenPeriodSelect({ value, periods, onChange, placeholder = '选择禁排时段' }) {
  const options = [
    ...periods.map((period) => ({
      label: `每天${period.name}`,
      value: `*-${period.id}`,
    })),
  ]
  const selectedValues = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      style={{ width: '100%' }}
      placeholder={placeholder}
      value={selectedValues}
      options={options}
      optionFilterProp="label"
      maxTagCount="responsive"
      onChange={(nextValues) => onChange(nextValues.join(','))}
    />
  )
}

export default function ScheduleManage() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [periods, setPeriods] = useState([])
  const [periodPlanIds, setPeriodPlanIds] = useState([])
  const [grade, setGrade] = useState('')
  const [plans, setPlans] = useState([createEmptyPlan()])
  const [arrangements, setArrangements] = useState([createEmptyArrangement()])
  const [arrangementClassFilter, setArrangementClassFilter] = useState(undefined)
  const [overrides, setOverrides] = useState([createEmptyOverride()])
  const [teacherConstraints, setTeacherConstraints] = useState([createEmptyTeacherConstraint()])
  const [locks, setLocks] = useState([createEmptyLock()])
  const [task, setTask] = useState(null)
  const [currentDraftId, setCurrentDraftId] = useState(null)
  const [currentDraft, setCurrentDraft] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [reviewClassId, setReviewClassId] = useState(undefined)
  const [previewClassId, setPreviewClassId] = useState(undefined)
  const [activeTab, setActiveTab] = useState('overview')
  const [reloadTick, setReloadTick] = useState(0)
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [solveLoading, setSolveLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [debugExportLoading, setDebugExportLoading] = useState(false)
  const [draftExportLoading, setDraftExportLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState(0)
  const [importGrade, setImportGrade] = useState('')
  const [importScope, setImportScope] = useState('class')
  const [importClassId, setImportClassId] = useState(undefined)
  const [importFile, setImportFile] = useState(null)
  const [importTask, setImportTask] = useState(null)
  const [importItems, setImportItems] = useState([])
  const [importStatusFilter, setImportStatusFilter] = useState('all')
  const [importLoading, setImportLoading] = useState(false)
  const [importDraftId, setImportDraftId] = useState(null)
  const [editingImportItem, setEditingImportItem] = useState(null)
  const pollingRef = useRef(null)
  const reviewSectionRef = useRef(null)
  const draftSectionRef = useRef(null)
  const pendingDraftScrollRef = useRef(false)
  const configWorkspaceRef = useRef(null)
  const [reviewTab, setReviewTab] = useState('draft')

  const gradeOptions = useMemo(
    () =>
      [...new Set(classes.map((item) => item.grade).filter(Boolean))]
        .sort(compareGrade)
        .map((item) => ({ label: item, value: item })),
    [classes],
  )

  const summaryCounts = buildSummaryCounts({ plans, arrangements, overrides, teacherConstraints, locks })
  const taskSnapshot = buildTaskSnapshot({ task, currentDraft, draftItems })
  const gradeClasses = useMemo(() => classes.filter((item) => item.grade === grade), [classes, grade])
  const configWarnings = buildConfigWarnings({ classes: gradeClasses, plans, arrangements, subjects, dirty })
  const classOptions = gradeClasses.map((item) => ({ label: `${item.grade}-${item.name}`, value: item.id }))
  const arrangementRows = useMemo(() => arrangements.map((item, index) => ({ ...item, __index: index })), [arrangements])
  const visibleArrangementRows = useMemo(
    () => arrangementClassFilter ? arrangementRows.filter((item) => item.class_id === arrangementClassFilter) : arrangementRows,
    [arrangementClassFilter, arrangementRows],
  )
  const selectedDraftItems = reviewClassId ? draftItems.filter((item) => item.class_id === reviewClassId) : draftItems
  const draftPeriodIds = new Set(selectedDraftItems.map((item) => item.period_id))
  const reviewPeriods = periods.filter((item) => draftPeriodIds.has(item.id))
  const draftRows = buildTimetableRows(selectedDraftItems, reviewPeriods)
  const reviewClassLabel = classOptions.find((item) => item.value === reviewClassId)?.label || '未选择班级'
  const importGradeClasses = classes.filter((item) => item.grade === importGrade)
  const importClassOptions = importGradeClasses.map((item) => ({ label: `${item.grade}-${item.name}`, value: item.id }))
  const subjectOptions = subjects.map((item) => ({ label: item.name, value: item.id }))
  const teacherOptions = teachers.map((item) => ({ label: item.username, value: item.id }))
  const periodOptions = periods.map((item) => ({ label: item.name, value: item.id }))
  const autoPeriodOptions = periods
    .filter((item) => item.is_active && item.include_in_auto_schedule)
    .map((item) => ({ label: `${item.name} ${item.start_time}-${item.end_time}`, value: item.id }))
  const selectedAutoPeriods = periods.filter((item) => periodPlanIds.includes(item.id))
  const constraintPeriodOptions = (selectedAutoPeriods.length ? selectedAutoPeriods : periods.filter((item) => item.is_active && item.include_in_auto_schedule))
    .slice()
    .sort((left, right) => (left.sort_order ?? left.id) - (right.sort_order ?? right.id))
  const periodPlanCapacity = selectedAutoPeriods.length * 5
  const importIssues = summarizeImportIssues(importItems)
  const importReadyForDraft = canCreateImportDraft(importItems)
  const filteredImportItems = useMemo(() => filterImportItemsByStatus(importItems, importStatusFilter), [importItems, importStatusFilter])
  const coreConfigReady = summaryCounts.plans > 0 && summaryCounts.arrangements > 0 && periodPlanIds.length > 0
  const publishChecks = currentDraft?.publish_checks || []
  const blockingPublishChecks = publishChecks.filter((item) => item.blocking)
  const workspaceStage = useMemo(() => {
    if (activeTab !== 'draft' && activeTab !== 'overview' && !solveLoading && !publishLoading) return 'prepare'
    if (task && !['success', 'failed'].includes(task.status)) return 'solving'
    if (currentDraft?.status === 'published') return 'published'
    if (currentDraftId || currentDraft) return 'review'
    return 'prepare'
  }, [activeTab, currentDraft, currentDraftId, publishLoading, solveLoading, task])

  useEffect(() => {
    if (!gradeClasses.length) {
      setReviewClassId(undefined)
      setPreviewClassId(undefined)
      setPreviewRows([])
      return
    }
    if (!reviewClassId || !gradeClasses.some((item) => item.id === reviewClassId)) {
      setReviewClassId(gradeClasses[0].id)
    }
  }, [gradeClasses, reviewClassId])

  useEffect(() => {
    if (!(workspaceStage === 'review' || workspaceStage === 'published')) return
    if (!reviewClassId) {
      setPreviewClassId(undefined)
      setPreviewRows([])
      return
    }
    handlePreviewClass(reviewClassId)
  }, [reviewClassId, workspaceStage])

  const readinessPercent = useMemo(() => {
    const checkpoints = [Boolean(grade), periodPlanIds.length > 0, summaryCounts.plans > 0, summaryCounts.arrangements > 0, !dirty]
    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100)
  }, [dirty, grade, periodPlanIds.length, summaryCounts.arrangements, summaryCounts.plans])

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
    if (!periodPlanIds.length) {
      return {
        title: '配置节次计划',
        description: '选择当前年级自动排课实际使用的节次，例如每天 7 节时只勾选第1节到第7节。',
        tab: 'periods',
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
  }, [activeTab, currentDraft, dirty, grade, periodPlanIds.length, summaryCounts.arrangements, summaryCounts.plans])

  function markDirty() {
    setDirty(true)
  }

  function handlePeriodPlanChange(values) {
    setPeriodPlanIds(values)
    markDirty()
  }

  function replaceRow(setter, index, patch) {
    setter((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)))
    markDirty()
  }

  function addRow(setter, factory) {
    setter((current) => [...current, factory()])
    markDirty()
  }

  function handleAddArrangement() {
    setArrangements((current) => [...current, { ...createEmptyArrangement(), class_id: arrangementClassFilter }])
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
    const firstClassId = gradeClasses[0]?.id
    if (!firstClassId) {
      if (arrangementClassFilter !== undefined) setArrangementClassFilter(undefined)
      return
    }
    if (!gradeClasses.some((item) => item.id === arrangementClassFilter)) {
      setArrangementClassFilter(firstClassId)
    }
  }, [arrangementClassFilter, gradeClasses])

  useEffect(() => {
    if (!grade) return

    let cancelled = false

    async function loadConfig() {
      setConfigLoading(true)
      setPageError('')
      try {
        const [plansResp, periodPlanResp, arrangementsResp, overridesResp, constraintsResp, locksResp] = await Promise.all([
          getLessonPlan(grade),
          getPeriodPlan(grade),
          getTeachingArrangement(grade),
          getLessonPlanOverrides(grade),
          getTeacherConstraints(grade),
          getTimetableLocks(grade),
        ])
        if (cancelled) return

        setPlans(normalizePlans(plansResp.data?.items || []))
        setPeriodPlanIds(periodPlanResp.data?.period_ids || [])
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

  useEffect(() => {
    if (importOpen || !pendingDraftScrollRef.current) return
    const timer = window.setTimeout(() => {
      draftSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      pendingDraftScrollRef.current = false
    }, 180)
    return () => window.clearTimeout(timer)
  }, [activeTab, importOpen])

  useEffect(() => {
    if (workspaceStage === 'review') setReviewTab('draft')
    if (workspaceStage === 'published') setReviewTab('published')
  }, [workspaceStage])

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
        savePeriodPlan({
          grade,
          period_ids: periodPlanIds.map((item) => Number(item)),
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
      if (reviewClassId) {
        const response = await getClassTimetable(reviewClassId)
        setPreviewRows(buildTimetableRows(response.data?.items || [], periods))
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
      setPreviewRows(buildTimetableRows(response.data?.items || [], periods))
    } catch (error) {
      message.error(error.message || '正式课表预览加载失败')
    }
  }

  function handleReviewClassChange(classId) {
    setReviewClassId(classId)
  }

  function renderReviewTimetableBlock(title, description, rows, emptyDescription) {
    return (
      <div style={{ border: '1px solid rgba(177, 195, 219, 0.42)', borderRadius: 14, padding: 14, background: 'rgba(248, 251, 255, 0.72)' }}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space size={8} align="center">
              <TableOutlined style={{ color: pageTokens.primary }} />
              <Text strong>{title}</Text>
            </Space>
            <Text type="secondary">{description}</Text>
          </Space>
          {rows.length ? (
            <Table size="small" rowKey="key" pagination={false} columns={timetableColumns} dataSource={rows} scroll={{ x: 900 }} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
          )}
        </Space>
      </div>
    )
  }

  function resetImportWizard() {
    const nextImportGrade = grade || gradeOptions[0]?.value || ''
    const nextImportClassId = classes.find((item) => item.grade === nextImportGrade)?.id
    setImportStep(0)
    setImportGrade(nextImportGrade)
    setImportScope('class')
    setImportClassId(nextImportClassId)
    setImportFile(null)
    setImportTask(null)
    setImportItems([])
    setImportStatusFilter('all')
    setImportDraftId(null)
    setEditingImportItem(null)
  }

  function handleImportGradeChange(value) {
    const nextClassId = classes.find((item) => item.grade === value)?.id
    setImportGrade(value)
    setImportClassId(nextClassId)
  }

  async function hasPublishedTimetableForGrade() {
    const checks = await Promise.all(
      importGradeClasses.map(async (classItem) => {
        const response = await getClassTimetable(classItem.id)
        return Boolean(response.data?.items?.length)
      }),
    )
    return checks.some(Boolean)
  }

  async function handleOpenImportWizard() {
    if (!gradeOptions.length) return message.warning('当前学校没有可导入的年级')
    resetImportWizard()
    setImportOpen(true)
  }

  async function refreshImportItems(importId) {
    const response = await getScheduleImportItems(importId)
    const nextItems = response.data?.items || []
    setImportItems(nextItems)
    return nextItems
  }

  async function handleUploadImport() {
    if (!importGrade) return message.warning('请选择目标年级')
    if (!importGradeClasses.length) return message.warning('当前年级没有可导入的班级')
    if (importScope === 'class' && !importClassId) return message.warning('请选择班级')
    if (!importFile) return message.warning('请先选择课表文件')

    try {
      if (await hasPublishedTimetableForGrade()) {
        const confirmed = await new Promise((resolve) => {
          Modal.confirm({
            title: '当前年级已有正式课表',
            content: '上传新课表只会生成待确认草案，不会立即覆盖正式课表。是否继续？',
            okText: '继续上传',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return
      }
    } catch (error) {
      return message.error(error.message || '检查已有课表失败')
    }

    const formData = new FormData()
    formData.append('grade', importGrade)
    formData.append('scope', importScope)
    if (importScope === 'class') formData.append('class_id', String(importClassId))
    formData.append('file', importFile)

    setImportLoading(true)
    try {
      const response = await createScheduleImport(formData)
      const task = response.data
      setImportTask(task)
      if (task?.status === 'failed') {
        message.error(task.error || task.message || '课表识别失败')
        return
      }
      const nextItems = await refreshImportItems(task.id)
      setImportStatusFilter(summarizeImportIssues(nextItems).unresolved ? 'unresolved' : 'all')
      setImportStep(2)
      message.success('课表已识别，请核对后生成待确认草案')
    } catch (error) {
      message.error(error.message || '上传已有课表失败')
    } finally {
      setImportLoading(false)
    }
  }

  async function handleDownloadImportTemplate() {
    try {
      const response = await downloadScheduleImportTemplate()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = '课表导入模板.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      message.error(error.message || '下载Excel模板失败')
    }
  }

  async function handleExportDebugConfig() {
    if (!grade) return message.warning('请先选择年级')
    if (dirty) return message.warning('请先保存配置后再导出调试包')

    setDebugExportLoading(true)
    try {
      const response = await exportScheduleDebugConfig(grade)
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `schedule-debug-${grade}-${timestamp}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('排课调试包已导出')
    } catch (error) {
      message.error(error.message || '导出调试包失败')
    } finally {
      setDebugExportLoading(false)
    }
  }

  async function handleExportDraft() {
    if (!currentDraftId) return message.warning('当前没有可导出的草案')

    setDraftExportLoading(true)
    try {
      const response = await exportScheduleDraft(currentDraftId)
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `schedule-draft-${grade || currentDraftId}-${timestamp}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('课表已导出')
    } catch (error) {
      message.error(error.message || '导出课表失败')
    } finally {
      setDraftExportLoading(false)
    }
  }

  async function handleSaveImportItem(values) {
    if (!importTask || !editingImportItem) return
    setImportLoading(true)
    try {
      await patchScheduleImportItem(importTask.id, editingImportItem.id, values)
      await refreshImportItems(importTask.id)
      setEditingImportItem(null)
      message.success('课位已更新')
    } catch (error) {
      message.error(error.message || '课位更新失败')
    } finally {
      setImportLoading(false)
    }
  }

  async function handleCreateImportDraft() {
    if (!importTask) return message.warning('请先上传并核对课表')
    if (!importReadyForDraft) return message.warning('仍有未处理课位，不能生成待确认草案')

    setImportLoading(true)
    try {
      const response = await createScheduleImportDraft(importTask.id)
      const draftId = response.data?.draft_id
      setImportDraftId(draftId)
      setCurrentDraftId(draftId)
      if (importGrade && importGrade !== grade) setGrade(importGrade)
      if (draftId) await loadDraftBundle(draftId)
      setTask({ status: 'success', progress: 100, message: '上传课表识别生成待确认草案', result: { draft_id: draftId } })
      setActiveTab('draft')
      setImportStep(3)
      message.success('已生成待确认草案，正式课表尚未变更')
    } catch (error) {
      message.error(error.message || '生成待确认草案失败')
    } finally {
      setImportLoading(false)
    }
  }

  function handleViewImportDraft() {
    pendingDraftScrollRef.current = true
    setReviewTab('draft')
    setActiveTab('draft')
    setImportOpen(false)
  }

  function scrollToSection(ref) {
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openConfigTab(tabKey) {
    setActiveTab(tabKey)
    scrollToSection(configWorkspaceRef)
  }

  function handlePrimaryStageAction() {
    if (!grade) {
      message.warning('请先选择年级')
      return
    }
    if (workspaceStage === 'prepare') {
      if (!summaryCounts.plans) {
        openConfigTab('plans')
        return
      }
      if (!summaryCounts.arrangements) {
        openConfigTab('arrangements')
        return
      }
      if (dirty) {
        handleSaveAll()
        return
      }
      handleSolve()
      return
    }
    if (workspaceStage === 'review') {
      if (canPublishCurrentDraft) {
        handlePublishDraft()
        return
      }
      scrollToSection(draftSectionRef)
      return
    }
    if (workspaceStage === 'published') {
      setReviewTab('published')
      scrollToSection(reviewSectionRef)
    }
  }

  const importItemColumns = [
    { title: '班级', dataIndex: 'class_name', width: 100, render: (value) => value || '-' },
    { title: '星期', dataIndex: 'weekday', width: 90, render: (value) => WEEKDAY_OPTIONS.find((item) => item.value === value)?.label || value },
    { title: '节次', dataIndex: 'period_name', width: 100, render: (value, record) => value || `第${record.period_id}节` },
    {
      title: '识别结果',
      dataIndex: 'recognized_subject_name',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.subject_name || record.recognized_subject_name || '未识别'}</Text>
          <Text type="secondary">{record.teacher_name || '未匹配教师'}</Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'issue_flags', width: 190, render: (flags) => <ImportIssueTags flags={flags || []} /> },
    { title: '匹配来源', dataIndex: 'teacher_match_source', width: 140, render: (value) => <Tag>{value || '-'}</Tag> },
    { title: '操作', key: 'actions', width: 90, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => setEditingImportItem(record)}>修正</Button> },
  ]

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
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <ForbiddenPeriodSelect periods={constraintPeriodOptions} value={record.forbidden_periods_text} onChange={(value) => replaceRow(setPlans, index, { forbidden_periods_text: value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setPlans, index, createEmptyPlan)}>删除</Button> },
  ]

  const arrangementColumns = [
    {
      title: '班级',
      dataIndex: 'class_id',
      width: 180,
      render: (_, record, index) => {
        const rowIndex = record.__index ?? index
        return <Select allowClear placeholder="选择班级" value={record.class_id} options={classOptions} onChange={(value) => replaceRow(setArrangements, rowIndex, { class_id: value })} />
      },
    },
    {
      title: '科目',
      dataIndex: 'subject_id',
      width: 180,
      render: (_, record, index) => {
        const rowIndex = record.__index ?? index
        return <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setArrangements, rowIndex, { subject_id: value })} />
      },
    },
    {
      title: '教师',
      dataIndex: 'teacher_id',
      render: (_, record, index) => {
        const rowIndex = record.__index ?? index
        return <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setArrangements, rowIndex, { teacher_id: value })} />
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 70,
      fixed: 'right',
      render: (_, record, index) => {
        const rowIndex = record.__index ?? index
        return <Button danger type="text" onClick={() => removeRow(setArrangements, rowIndex, createEmptyArrangement)}>删除</Button>
      },
    },
  ]

  const overrideColumns = [
    { title: '班级', dataIndex: 'class_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择班级" value={record.class_id} options={classOptions} onChange={(value) => replaceRow(setOverrides, index, { class_id: value })} /> },
    { title: '科目', dataIndex: 'subject_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择科目" value={record.subject_id} options={subjectOptions} onChange={(value) => replaceRow(setOverrides, index, { subject_id: value })} /> },
    { title: '周课时', dataIndex: 'weekly_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={30} style={{ width: '100%' }} value={record.weekly_hours} onChange={(value) => replaceRow(setOverrides, index, { weekly_hours: value ?? 0 })} /> },
    { title: '单日上限', dataIndex: 'daily_max_hours', width: 110, render: (_, record, index) => <InputNumber min={0} max={10} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setOverrides, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '偏好时段', dataIndex: 'preferred_session', width: 130, render: (_, record, index) => <Select value={record.preferred_session} options={SESSION_OPTIONS} onChange={(value) => replaceRow(setOverrides, index, { preferred_session: value })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <ForbiddenPeriodSelect periods={constraintPeriodOptions} value={record.forbidden_periods_text} onChange={(value) => replaceRow(setOverrides, index, { forbidden_periods_text: value })} /> },
    { title: '操作', key: 'actions', width: 70, fixed: 'right', render: (_, __, index) => <Button danger type="text" onClick={() => removeRow(setOverrides, index, createEmptyOverride)}>删除</Button> },
  ]

  const teacherConstraintColumns = [
    { title: '教师', dataIndex: 'teacher_id', width: 180, render: (_, record, index) => <Select allowClear placeholder="选择教师" value={record.teacher_id} options={teacherOptions} onChange={(value) => replaceRow(setTeacherConstraints, index, { teacher_id: value })} /> },
    { title: '单日最大课时', dataIndex: 'daily_max_hours', width: 130, render: (_, record, index) => <InputNumber min={0} max={12} style={{ width: '100%' }} value={record.daily_max_hours} onChange={(value) => replaceRow(setTeacherConstraints, index, { daily_max_hours: value ?? 0 })} /> },
    { title: '禁排时段', dataIndex: 'forbidden_periods_text', render: (_, record, index) => <ForbiddenPeriodSelect periods={constraintPeriodOptions} value={record.forbidden_periods_text} onChange={(value) => replaceRow(setTeacherConstraints, index, { forbidden_periods_text: value })} /> },
    { title: '优先时段', dataIndex: 'preferred_periods_text', render: (_, record, index) => <ForbiddenPeriodSelect periods={constraintPeriodOptions} value={record.preferred_periods_text} placeholder="选择优先时段" onChange={(value) => replaceRow(setTeacherConstraints, index, { preferred_periods_text: value })} /> },
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
    { key: 'periods', title: '节次计划', metric: `${selectedAutoPeriods.length} 节/天`, description: '配置本次自动排课实际使用的一天节次数，可按年级选择 7 节或 8 节。' },
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
      key: 'periods',
      label: <Space size={6}><span>节次计划</span><Tag bordered={false}>{selectedAutoPeriods.length}</Tag></Space>,
      children: (
        <SectionCard
          eyebrow="PERIOD PLAN"
          title="年级节次计划"
          description="这里定义当前年级自动排课实际使用的一天节次数。全校节次模板可以保留 8 节，但本次排课只使用选中的节次。"
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type={periodPlanIds.length ? 'info' : 'warning'}
              showIcon
              message={periodPlanIds.length ? `当前每天参与排课 ${selectedAutoPeriods.length} 节` : '请至少选择一个参与排课的节次'}
              description={`按周一至周五计算，当前自动排课容量为 ${periodPlanCapacity} 个课位。`}
            />
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              placeholder="选择参与自动排课的节次"
              value={periodPlanIds}
              options={autoPeriodOptions}
              onChange={handlePeriodPlanChange}
            />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}><ReviewStatCard title="每日节次" value={selectedAutoPeriods.length} helper="当前年级自动排课使用" /></Col>
              <Col xs={24} md={8}><ReviewStatCard title="周容量" value={periodPlanCapacity} helper="按周一至周五计算" /></Col>
              <Col xs={24} md={8}><ReviewStatCard title="全校模板" value={autoPeriodOptions.length} helper="可参与自动排课的节次" /></Col>
            </Row>
          </Space>
        </SectionCard>
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
        <SectionCard
          eyebrow="TEACHING MAP"
          title="班级-科目-教师分配"
          description="自动排课前，先把授课关系梳理清楚。这里越完整，草案越稳定。"
          extra={(
            <Space wrap>
              <Select
                style={{ width: 180 }}
                placeholder="按班级筛选"
                value={arrangementClassFilter}
                options={classOptions}
                onChange={setArrangementClassFilter}
              />
              <Button onClick={handleAddArrangement}>新增安排</Button>
            </Space>
          )}
        >
          <Table size="middle" rowKey={(record, index) => `arrangement-${record.__index ?? index}`} pagination={false} columns={arrangementColumns} dataSource={visibleArrangementRows} scroll={{ x: 780 }} />
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
  const canPublishCurrentDraft = Boolean(currentDraftId && taskSnapshot.readyToPublish)
  const stageIndex = { prepare: 0, solving: 1, review: 2, published: 3 }[workspaceStage]
  const stageSummary = workspaceStage === 'prepare'
    ? {
        title: '准备排课数据',
        description: coreConfigReady
          ? (dirty ? '核心配置已齐全，建议先保存后再开始自动排课。' : '核心配置已就绪，可以直接开始自动排课。')
          : `还缺核心配置：${summaryCounts.plans ? '任课安排' : '课时计划'}`,
        status: coreConfigReady ? '可生成草案' : '待补齐配置',
      }
    : workspaceStage === 'solving'
      ? {
          title: '正在生成草案',
          description: taskSnapshot.description,
          status: '求解中',
        }
      : workspaceStage === 'review'
        ? {
            title: '复核草案并准备发布',
            description: canPublishCurrentDraft ? '草案已可发布，请复核后发布为正式课表。' : '当前草案仍需复核，请先检查风险项与对比结果。',
            status: canPublishCurrentDraft ? '待发布' : '待复核',
          }
        : {
            title: '正式课表已发布',
            description: '当前年级已有已发布的正式课表，可继续查看或再次调整生成新草案。',
            status: '已发布',
          }
  const primaryActionLabel = workspaceStage === 'prepare'
    ? (!coreConfigReady ? '补齐核心配置' : dirty ? '保存后开始排课' : '开始自动排课')
    : workspaceStage === 'solving'
      ? '正在生成草案...'
      : workspaceStage === 'review'
        ? (canPublishCurrentDraft ? '发布为正式课表' : '查看草案详情')
        : '查看正式课表'
  const stageStatusColor = workspaceStage === 'prepare'
    ? (coreConfigReady ? 'blue' : 'orange')
    : workspaceStage === 'solving'
      ? 'processing'
      : workspaceStage === 'review'
        ? (canPublishCurrentDraft ? 'success' : 'warning')
        : 'success'

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
                    <Text style={{ color: 'rgba(255,255,255,0.72)', display: 'block', marginBottom: 8 }}>当前流程</Text>
                    <Select style={{ width: '100%' }} placeholder="选择年级" value={grade || undefined} options={gradeOptions} onChange={setGrade} />
                  </div>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12}><Button block icon={<ReloadOutlined />} loading={configLoading} onClick={() => setReloadTick((value) => value + 1)}>刷新配置</Button></Col>
                    <Col xs={24} sm={12}><Button block icon={<SaveOutlined />} loading={saveLoading} onClick={handleSaveAll}>保存配置</Button></Col>
                    <Col xs={24} sm={12}><Button block icon={<DownloadOutlined />} loading={debugExportLoading} onClick={handleExportDebugConfig}>导出调试包</Button></Col>
                    <Col xs={24} sm={12}><Button block icon={<UploadOutlined />} disabled={!gradeOptions.length} onClick={handleOpenImportWizard}>上传已有课表</Button></Col>
                    <Col xs={24} sm={12}>
                      <Button
                        block
                        size="large"
                        type="primary"
                        icon={workspaceStage === 'review' || workspaceStage === 'published' ? <SendOutlined /> : <RobotOutlined />}
                        loading={workspaceStage === 'solving' ? solveLoading : publishLoading}
                        disabled={workspaceStage === 'solving'}
                        onClick={handlePrimaryStageAction}
                      >
                        {primaryActionLabel}
                      </Button>
                    </Col>
                  </Row>
                  <div style={{ borderRadius: 18, padding: 14, background: 'rgba(7, 18, 34, 0.26)', color: '#ffffff' }}>
                    <Text style={{ display: 'block', color: 'rgba(255,255,255,0.72)', marginBottom: 6 }}>当前阶段</Text>
                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text style={{ display: 'block', color: '#ffffff', fontWeight: 600 }}>{stageSummary.title}</Text>
                      <Tag color={stageStatusColor}>{stageSummary.status}</Tag>
                    </Space>
                    <Text style={{ color: 'rgba(255,255,255,0.72)' }}>{stageSummary.description}</Text>
                  </div>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        {pageError ? <Alert type="error" showIcon message={pageError} /> : null}

        <Spin spinning={configLoading}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <SectionCard
              eyebrow="WORKFLOW"
              title="排课流程"
              description="把准备、生成、复核、发布收敛到同一条任务流里，减少新手在页面里来回找入口。"
              extra={<Tag color={stageStatusColor}>{stageSummary.status}</Tag>}
            >
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <Steps
                  current={stageIndex}
                  items={[
                    { title: '准备数据', description: '课时计划与任课安排' },
                    { title: '生成草案', description: '启动排课引擎' },
                    { title: '复核草案', description: '核对草案与正式课表' },
                    { title: '发布生效', description: '替换正式课表' },
                  ]}
                />
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}><ReviewStatCard title="当前状态" value={stageSummary.status} helper={stageSummary.title} /></Col>
                  <Col xs={24} md={8}><ReviewStatCard title="完成度" value={`${readinessPercent}%`} helper={coreConfigReady ? '核心配置已具备基础条件' : '仍有核心项待完善'} /></Col>
                  <Col xs={24} md={8}><ReviewStatCard title="下一步" value={primaryActionLabel} helper={stageSummary.description} /></Col>
                </Row>
              </Space>
            </SectionCard>

            <Row gutter={[20, 20]} align="top">
              <Col xs={24} xl={16}>
                {workspaceStage === 'prepare' ? (
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <SectionCard
                      eyebrow="PREPARE"
                      title="先补齐核心配置，再开始排课"
                      description="对于第一次使用排课功能的老师，只需要先完成课时计划和任课安排；教师约束与锁定课位属于优化项。"
                      extra={<Button type="primary" icon={<RobotOutlined />} disabled={!coreConfigReady} loading={solveLoading} onClick={handlePrimaryStageAction}>开始自动排课</Button>}
                    >
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        {task?.status === 'failed' ? (
                          <Alert type="error" showIcon message={taskSnapshot.title} description={taskSnapshot.description} />
                        ) : null}
                        {coreConfigReady ? (
                          <Alert type="success" showIcon message="当前已具备生成草案的基础条件" description={dirty ? '检测到未保存修改，建议先保存，再开始自动排课。' : '现在可以直接开始自动排课，也可以继续补充教师约束和锁定课位。'} />
                        ) : (
                          <Alert type="warning" showIcon message="还有核心配置待完成" description={`请优先补齐${summaryCounts.plans ? '任课安排' : '课时计划'}，这样系统才能生成有效草案。`} />
                        )}
                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={8}>
                            <WorkflowTaskTile
                              title="课时计划"
                              helper="定义每个学科的周课时、单日上限和禁排时段。"
                              status={summaryCounts.plans ? 'done' : 'todo'}
                              detail={summaryCounts.plans ? `已配置 ${summaryCounts.plans} 条规则` : '当前还没有可供排课的基础课时规则'}
                              actionLabel="打开课时计划"
                              onAction={() => openConfigTab('plans')}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <WorkflowTaskTile
                              title="任课安排"
                              helper="建立班级、科目、教师三者之间的授课关系。"
                              status={summaryCounts.arrangements ? 'done' : 'todo'}
                              detail={summaryCounts.arrangements ? `已绑定 ${summaryCounts.arrangements} 条任课安排` : '当前还没有班级-科目-教师的绑定关系'}
                              actionLabel="打开任课安排"
                              onAction={() => openConfigTab('arrangements')}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <WorkflowTaskTile
                              title="高级规则"
                              helper="用于处理教师个人时间、兼课安排和固定不变的课位。"
                              status={summaryCounts.teacherConstraints || summaryCounts.locks ? 'done' : 'todo'}
                              optional
                              detail={`教师约束 ${summaryCounts.teacherConstraints} 条，锁定课位 ${summaryCounts.locks} 条`}
                              actionLabel="打开高级规则"
                              onAction={() => openConfigTab(summaryCounts.teacherConstraints ? 'locks' : 'constraints')}
                            />
                          </Col>
                        </Row>
                      </Space>
                    </SectionCard>
                    <div ref={configWorkspaceRef}>
                      <SectionCard eyebrow="CONFIGURATION MODULES" title="排课配置详情" description="先配置核心规则，再补充高级约束。需要时也可以直接在这里细调。">
                        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                      </SectionCard>
                    </div>
                  </Space>
                ) : null}

                {workspaceStage === 'solving' ? (
                  <SectionCard eyebrow="SOLVING" title="正在生成草案" description="系统正在根据当前年级配置计算可行课表。现在不需要继续填写配置，只需等待结果。">
                    <Space direction="vertical" size={18} style={{ width: '100%' }}>
                      <Alert type="info" showIcon message={taskSnapshot.title} description={taskSnapshot.description} />
                      <Progress percent={Number(taskSnapshot.progress || 0)} strokeColor={pageTokens.primary} />
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={8}><ReviewStatCard title="当前阶段" value="生成草案" helper="系统正在计算可行解" /></Col>
                        <Col xs={24} md={8}><ReviewStatCard title="当前年级" value={grade || '--'} helper="本次排课目标年级" /></Col>
                        <Col xs={24} md={8}><ReviewStatCard title="草案状态" value="求解中" helper="完成后会自动进入复核阶段" /></Col>
                      </Row>
                    </Space>
                  </SectionCard>
                ) : null}

                {workspaceStage === 'review' || workspaceStage === 'published' ? (
                  <div ref={reviewSectionRef}>
                    <SectionCard
                      eyebrow="REVIEW"
                      title={workspaceStage === 'published' ? '正式课表已发布' : '复核草案并决定是否发布'}
                      description={workspaceStage === 'published' ? '当前草案已经发布为正式课表。你可以继续查看正式课表，或者调整后再次生成新草案。' : '草案生成后，请先查看草案课表、正式课表对比和风险清单，再决定是否发布。'}
                      extra={<Button type="primary" icon={<SendOutlined />} loading={publishLoading} disabled={!canPublishCurrentDraft} onClick={handlePublishDraft}>发布为正式课表</Button>}
                    >
                    <Space direction="vertical" size={18} style={{ width: '100%' }}>
                      <Alert
                        type={workspaceStage === 'published' ? 'success' : canPublishCurrentDraft ? 'success' : 'warning'}
                        showIcon
                        message={workspaceStage === 'published' ? '正式课表已发布生效' : '草案已生成，正式课表尚未变更'}
                        description={workspaceStage === 'published'
                          ? '如需进一步调整，可以回到配置区修改后再次生成新草案。'
                          : canPublishCurrentDraft
                            ? '当前草案已通过发布检查。建议先对照草案课表与正式课表，再进行发布。'
                            : '当前草案仍有待复核项，请先查看风险清单和正式课表对比。'}
                      />
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={6}><ReviewStatCard title="草案得分" value={currentDraftScore} helper="当前草案质量评分" /></Col>
                        <Col xs={24} md={6}><ReviewStatCard title="风险数" value={riskCount} helper="待复核风险条目" /></Col>
                        <Col xs={24} md={6}><ReviewStatCard title="锁定命中" value={`${lockedHits}/${lockedTotal}`} helper="锁定规则满足情况" /></Col>
                        <Col xs={24} md={6}><ReviewStatCard title="草案课位" value={draftItems.length} helper="本次生成课位数量" /></Col>
                      </Row>
                      <Alert
                        type="info"
                        showIcon
                        message={`当前班级：${reviewClassLabel}`}
                        description="下面的正式课表与草案课表会针对同一个班级并排展示，便于快速发现变化。"
                      />
                      <Tabs
                        activeKey={reviewTab}
                        onChange={setReviewTab}
                        items={[
                          {
                            key: 'draft',
                            label: '草案课表',
                            children: (
                              <div ref={draftSectionRef}>
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                  <Select placeholder="选择班级查看草案课表" value={reviewClassId} options={classOptions} onChange={handleReviewClassChange} />
                                  {renderReviewTimetableBlock('草案课表', reviewClassLabel, draftRows, '当前还没有草案课表，保存配置后即可开始排课。')}
                                </Space>
                              </div>
                            ),
                          },
                          {
                            key: 'published',
                            label: '正式课表对比',
                            children: (
                              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                <Select placeholder="选择班级查看正式课表和草案课表" value={reviewClassId} options={classOptions} onChange={handleReviewClassChange} />
                                {renderReviewTimetableBlock('正式课表', reviewClassLabel, previewRows, '正式课表还没有发布。')}
                                <Divider style={{ margin: '6px 0' }} />
                                {renderReviewTimetableBlock('草案课表', reviewClassLabel, draftRows, '当前班级还没有草案课表。')}
                              </Space>
                            ),
                          },
                          {
                            key: 'risks',
                            label: `风险清单${publishChecks.length ? ` (${publishChecks.length})` : ''}`,
                            children: publishChecks.length ? (
                              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                {publishChecks.map((item) => (
                                  <Alert key={`${item.code}-${item.message}`} type={item.blocking ? 'error' : 'warning'} showIcon message={item.message} description={item.code} />
                                ))}
                              </Space>
                            ) : (
                              <Alert type="success" showIcon message="当前没有待处理风险项" description="这份草案目前没有额外的发布检查提醒。" />
                            ),
                          },
                        ]}
                      />
                      <Space wrap>
                        <Button onClick={() => openConfigTab(nextAction.tab === 'draft' ? 'periods' : nextAction.tab)}>返回调整配置</Button>
                        <Button icon={<RobotOutlined />} loading={solveLoading} onClick={handleSolve}>重新生成草案</Button>
                        <Button icon={<DownloadOutlined />} loading={draftExportLoading} disabled={!currentDraftId} onClick={handleExportDraft}>导出课表</Button>
                        <Button type="primary" icon={<SendOutlined />} loading={publishLoading} disabled={!canPublishCurrentDraft} onClick={handlePublishDraft}>发布为正式课表</Button>
                      </Space>
                    </Space>
                  </SectionCard>
                  </div>
                ) : null}
              </Col>
              <Col xs={24} xl={8}>
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <SectionCard eyebrow="STAGE STATUS" title="当前阶段" description="只保留决策需要的信息，避免把草案内容和对比表全部堆在侧边。">
                    <Space direction="vertical" size={14} style={{ width: '100%' }}>
                      <Alert type={workspaceStage === 'published' ? 'success' : workspaceStage === 'review' ? 'info' : workspaceStage === 'solving' ? 'info' : 'warning'} showIcon message={stageSummary.title} description={stageSummary.description} />
                      <ReviewStatCard title="当前状态" value={stageSummary.status} helper="页面会根据当前阶段自动切换主内容" />
                      <Button type="primary" icon={workspaceStage === 'review' || workspaceStage === 'published' ? <SendOutlined /> : <RobotOutlined />} loading={workspaceStage === 'solving' ? solveLoading : publishLoading} disabled={workspaceStage === 'solving'} onClick={handlePrimaryStageAction}>
                        {primaryActionLabel}
                      </Button>
                    </Space>
                  </SectionCard>

                  <SectionCard eyebrow="CHECKLIST" title="核心检查" description="先把真正决定能否排课的输入补齐，其他优化项可以后补。">
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Alert type={summaryCounts.plans ? 'success' : 'warning'} showIcon message={`课时计划：${summaryCounts.plans ? '已完成' : '待完成'}`} description={summaryCounts.plans ? `已配置 ${summaryCounts.plans} 条年级规则` : '先定义学科周课时、单日上限和禁排时段'} />
                      <Alert type={summaryCounts.arrangements ? 'success' : 'warning'} showIcon message={`任课安排：${summaryCounts.arrangements ? '已完成' : '待完成'}`} description={summaryCounts.arrangements ? `已绑定 ${summaryCounts.arrangements} 条任课关系` : '先补齐班级-科目-教师的授课关系'} />
                      <Alert type={summaryCounts.teacherConstraints ? 'success' : 'info'} showIcon message={`教师约束：${summaryCounts.teacherConstraints ? '已设置' : '可选'}`} description={summaryCounts.teacherConstraints ? `已设置 ${summaryCounts.teacherConstraints} 条教师约束` : '适合在基础配置稳定后做精细化控制'} />
                      <Alert type={summaryCounts.locks ? 'success' : 'info'} showIcon message={`锁定课位：${summaryCounts.locks ? '已设置' : '可选'}`} description={summaryCounts.locks ? `已锁定 ${summaryCounts.locks} 个固定课位` : '用于保留班会、公共课等不允许变化的课位'} />
                    </Space>
                  </SectionCard>

                  {(workspaceStage === 'review' || workspaceStage === 'published' || draftItems.length > 0) ? (
                    <SectionCard eyebrow="DRAFT STATUS" title="草案状态" description="复核时只盯住是否可发布、有哪些风险、锁定是否命中。">
                      <Space direction="vertical" size={14} style={{ width: '100%' }}>
                        <Row gutter={[12, 12]}>
                          <Col span={12}><ReviewStatCard title="草案得分" value={currentDraftScore} helper="当前草案质量评分" /></Col>
                          <Col span={12}><ReviewStatCard title="风险数" value={riskCount} helper="待复核风险条目" /></Col>
                          <Col span={12}><ReviewStatCard title="锁定命中" value={`${lockedHits}/${lockedTotal}`} helper="锁定规则满足情况" /></Col>
                          <Col span={12}><ReviewStatCard title="发布检查" value={blockingPublishChecks.length} helper="阻塞发布的问题数量" /></Col>
                        </Row>
                        {blockingPublishChecks.length ? (
                          <Alert type="warning" showIcon message="仍有发布前检查项待处理" description={blockingPublishChecks[0]?.message || '请先查看风险清单。'} />
                        ) : (
                          <Alert type="success" showIcon message="当前草案已可发布" description="建议再对照草案课表和正式课表预览，确认无误后发布。" />
                        )}
                      </Space>
                    </SectionCard>
                  ) : null}
                </Space>
              </Col>
            </Row>
          </Space>
        </Spin>

        <Modal
          title="上传已有课表"
          open={importOpen}
          width={980}
          onCancel={() => setImportOpen(false)}
          footer={null}
          destroyOnHidden
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Alert type="info" showIcon message="识别结果会先生成待确认草案，不会直接覆盖正式课表。" />
            <Steps current={importStep} items={IMPORT_STEPS} />

            {importStep === 0 ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Text strong>目标年级</Text>
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      placeholder="选择年级"
                      value={importGrade || undefined}
                      options={gradeOptions}
                      onChange={handleImportGradeChange}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Text strong>导入范围</Text>
                    <Select style={{ width: '100%', marginTop: 8 }} value={importScope} options={IMPORT_SCOPE_OPTIONS} onChange={setImportScope} />
                  </Col>
                  <Col xs={24} md={8}>
                    <Text strong>目标班级</Text>
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      disabled={importScope !== 'class'}
                      placeholder="选择班级"
                      value={importClassId}
                      options={importClassOptions}
                      onChange={setImportClassId}
                    />
                  </Col>
                </Row>
                <Alert
                  type="info"
                  showIcon
                  message="年级总课表支持多个 sheet，每个 sheet 名应对应一个班级，例如七一班、七1班。上传新课表只会生成待确认草案，不会立即覆盖正式课表。"
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" disabled={!importGrade || !importGradeClasses.length} onClick={() => setImportStep(1)}>下一步</Button>
                </div>
              </Space>
            ) : null}

            {importStep === 1 ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Upload.Dragger
                  maxCount={1}
                  accept=".xlsx,.xlsm,.xltx,.xltm"
                  beforeUpload={(file) => {
                    setImportFile(file)
                    return false
                  }}
                  onRemove={() => setImportFile(null)}
                >
                  <p className="ant-upload-drag-icon"><FileExcelOutlined /></p>
                  <p className="ant-upload-text">点击或拖拽上传已有课表</p>
                  <p className="ant-upload-hint">只支持 Excel 课表导入。年级总课表会按 sheet 名匹配班级；单元格可只填写科目，系统会自动匹配教师。</p>
                </Upload.Dragger>
                <Alert type="success" showIcon message="只支持 Excel 课表" description="请上传 .xlsx、.xlsm、.xltx 或 .xltm 文件。识别结果会进入核对页，并在生成草案前允许逐格修正。" />
                <Button icon={<FileExcelOutlined />} onClick={handleDownloadImportTemplate}>下载Excel模板</Button>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setImportStep(0)}>上一步</Button>
                  <Button type="primary" loading={importLoading} onClick={handleUploadImport}>开始识别</Button>
                </div>
              </Space>
            ) : null}

            {importStep === 2 ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={[12, 12]}>
                  <Col xs={12} md={6}><ReviewStatCard title="总课位" value={importIssues.total} helper="本次识别出的课位" /></Col>
                  <Col xs={12} md={6}><ReviewStatCard title="待处理" value={importIssues.unresolved} helper="需要修正后再生成" /></Col>
                  <Col xs={12} md={4}><ReviewStatCard title="未匹配教师" value={importIssues.teacherUnmatched} helper="需选择教师" /></Col>
                  <Col xs={12} md={4}><ReviewStatCard title="教师待确认" value={importIssues.teacherAmbiguous} helper="多个候选教师" /></Col>
                  <Col xs={12} md={4}><ReviewStatCard title="时间冲突" value={importIssues.teacherTimeConflict} helper="同节多班占用" /></Col>
                </Row>
                {importReadyForDraft ? (
                  <Alert type="success" showIcon message="识别结果已可生成待确认草案" description="生成后正式课表尚未变更，请在草案区确认后再发布。" />
                ) : (
                  <Alert type="warning" showIcon message="仍有未处理课位" description="请先修正未识别科目、未匹配教师、教师待确认或教师时间冲突项。" />
                )}
                {importIssues.teacherUnmatched ? (
                  <Alert
                    type="info"
                    showIcon
                    message="课表中只有科目时，需要先匹配教师"
                    description="如果上传的单班课表没有教师姓名，系统会根据“班级-科目-教师分配”自动匹配；没有匹配到时，请先到“班级-科目-教师分配”补齐任课安排，或在修正面板里手动选择教师。"
                  />
                ) : null}
                <Row gutter={[12, 12]} align="middle">
                  <Col xs={24} md={8}>
                    <Text strong>状态筛选</Text>
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      value={importStatusFilter}
                      options={IMPORT_STATUS_FILTER_OPTIONS}
                      onChange={setImportStatusFilter}
                    />
                  </Col>
                  <Col xs={24} md={16}>
                    <Text style={{ color: pageTokens.muted }}>
                      当前显示 {filteredImportItems.length} / {importItems.length} 个课位；识别完成后会优先显示待处理项。
                    </Text>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey="id"
                  columns={importItemColumns}
                  dataSource={filteredImportItems}
                  pagination={false}
                  scroll={{ x: 880, y: 360 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setImportStep(1)}>重新上传</Button>
                  <Button type="primary" loading={importLoading} disabled={!importReadyForDraft} onClick={handleCreateImportDraft}>生成待确认草案</Button>
                </div>
              </Space>
            ) : null}

            {importStep === 3 ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="success"
                  showIcon
                  message="已生成待确认草案，正式课表尚未变更"
                  description="请到当前草案课表中复核；点击发布并二次确认后，才会替换正式课表。"
                />
                <Space>
                  <Button disabled={!importDraftId} onClick={handleViewImportDraft}>查看草案</Button>
                  <Button type="primary" disabled={!importDraftId} onClick={() => setImportOpen(false)}>稍后发布</Button>
                </Space>
              </Space>
            ) : null}
          </Space>
        </Modal>

        <Drawer
          title="修正识别课位"
          open={Boolean(editingImportItem)}
          width={420}
          zIndex={1300}
          onClose={() => setEditingImportItem(null)}
        >
          {editingImportItem ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert type="info" showIcon message={`${editingImportItem.class_name || ''} ${WEEKDAY_OPTIONS.find((item) => item.value === editingImportItem.weekday)?.label || ''} ${editingImportItem.period_name || ''}`} />
              <div>
                <Text strong>科目</Text>
                <Select
                  allowClear
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="选择科目"
                  value={editingImportItem.subject_id}
                  options={subjectOptions}
                  notFoundContent="暂无科目"
                  onChange={(value) => setEditingImportItem((current) => ({ ...current, subject_id: value }))}
                />
                {(editingImportItem.issue_flags || []).includes('unrecognized_subject') || !subjectOptions.length ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 10 }}
                    message="没有对应的科目"
                    description="请先创建科目，添加后刷新本页，再回到这里选择。"
                  />
                ) : null}
              </div>
              <div>
                <Text strong>教师</Text>
                <Select
                  allowClear
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="选择教师"
                  value={editingImportItem.teacher_id}
                  options={teacherOptions}
                  notFoundContent="暂无教师"
                  onChange={(value) => setEditingImportItem((current) => ({ ...current, teacher_id: value }))}
                />
                {(editingImportItem.issue_flags || []).includes('teacher_unmatched') || !teacherOptions.length ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 10 }}
                    message="没有可选的教师"
                    description="请先创建教师账号，并在任课安排中绑定教师-班级-科目；添加后刷新本页再选择。"
                  />
                ) : null}
              </div>
              <div>
                <Text strong>当前状态</Text>
                <div style={{ marginTop: 8 }}><ImportIssueTags flags={editingImportItem.issue_flags || []} /></div>
              </div>
              {editingImportItem.conflict_items?.length ? (
                <Alert
                  type="error"
                  showIcon
                  message="教师时间冲突"
                  description={(
                    <Space direction="vertical" size={4}>
                      <Text>当前教师在同一时间已被以下课位占用，请更换教师或标记为空课。</Text>
                      {editingImportItem.conflict_items.map((item) => (
                        <Text key={item.id}>
                          {item.class_name || '未知班级'} {WEEKDAY_OPTIONS.find((option) => option.value === item.weekday)?.label || `周${item.weekday}`} {item.period_name || `第${item.period_id}节`} {item.subject_name || item.recognized_subject_name || '未识别科目'}
                        </Text>
                      ))}
                    </Space>
                  )}
                />
              ) : null}
              {editingImportItem.teacher_candidates?.length ? (
                <div>
                  <Text strong>候选教师</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {editingImportItem.teacher_candidates.map((candidate) => (
                        <Tag key={candidate.id} color="blue" style={{ cursor: 'pointer' }} onClick={() => setEditingImportItem((current) => ({ ...current, teacher_id: candidate.id }))}>{candidate.username}</Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              ) : null}
              <Divider />
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Button onClick={() => handleSaveImportItem({ is_empty: true })}>标记为空课</Button>
                <Button type="primary" loading={importLoading} onClick={() => handleSaveImportItem({ subject_id: editingImportItem.subject_id, teacher_id: editingImportItem.teacher_id, is_empty: false })}>保存</Button>
              </Space>
            </Space>
          ) : null}
        </Drawer>
      </Space>
    </div>
  )
}

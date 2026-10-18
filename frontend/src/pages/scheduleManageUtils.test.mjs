import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  buildConfigWarnings,
  findClassPlanSubjectsMissingArrangements,
  findArrangementSubjectsMissingPlans,
  findPlanSubjectsMissingArrangements,
  buildSummaryCounts,
  buildTaskSnapshot,
  buildTimetableRows,
  canCreateImportDraft,
  filterImportItemsByStatus,
  formatForbiddenPeriods,
  parseForbiddenPeriods,
  summarizeImportIssues,
} from './scheduleManageUtils.js'

const schedulingApiSource = await readFile(new URL('../api/scheduling.js', import.meta.url), 'utf8')
const scheduleManageSource = await readFile(new URL('./ScheduleManage.jsx', import.meta.url), 'utf8')

assert.match(scheduleManageSource, /arrangementClassFilter/)
assert.match(scheduleManageSource, /visibleArrangementRows/)
assert.match(scheduleManageSource, /dataSource=\{visibleArrangementRows\}/)
assert.match(scheduleManageSource, /ForbiddenPeriodSelect/)
assert.match(scheduleManageSource, /每天\$\{period\.name\}/)
assert.doesNotMatch(scheduleManageSource, /WEEKDAY_OPTIONS\.flatMap/)
assert.match(scheduleManageSource, /constraintPeriodOptions/)
assert.match(scheduleManageSource, /setArrangementClassFilter\(firstClassId\)/)
assert.match(schedulingApiSource, /exportScheduleDraft/)
assert.match(schedulingApiSource, /\/api\/schedule\/drafts\/\$\{draftId\}\/export/)
assert.match(scheduleManageSource, /handleExportDraft/)
assert.match(scheduleManageSource, /icon=\{<DownloadOutlined \/>\}[\s\S]*导出课表/)
assert.match(scheduleManageSource, /value=\{reviewClassId\}[\s\S]*onChange=\{handleReviewClassChange\}/)
assert.match(scheduleManageSource, /正式课表[\s\S]*正式课表还没有发布[\s\S]*草案课表/)
assert.match(scheduleManageSource, /reviewClassLabel/)
assert.match(scheduleManageSource, /renderReviewTimetableBlock/)
assert.match(scheduleManageSource, /<TableOutlined style=\{\{ color: pageTokens\.primary \}\} \/>/)
assert.match(scheduleManageSource, /renderReviewTimetableBlock\('正式课表'[\s\S]*renderReviewTimetableBlock\('草案课表'/)

assert.deepEqual(parseForbiddenPeriods('1-1, 5-3'), [[1, 1], [5, 3]])
assert.deepEqual(parseForbiddenPeriods('*-11, 2-13'), [[0, 11], [2, 13]])
assert.deepEqual(parseForbiddenPeriods('11'), [[0, 11]])
assert.equal(formatForbiddenPeriods([[2, 4], [3, 1]]), '2-4,3-1')
assert.equal(formatForbiddenPeriods([[0, 11], [2, 13]]), '*-11,2-13')

assert.deepEqual(
  buildTimetableRows([
    { weekday: 1, period_id: 1, subject_name: '数学', teacher_name: '张老师' },
  ]),
  [
    {
      key: '1',
      period_id: 1,
      periodLabel: '第1节',
      day_1: '数学 / 张老师',
      day_2: '',
      day_3: '',
      day_4: '',
      day_5: '',
    },
  ],
)

assert.deepEqual(
  buildTimetableRows(
    [
      { weekday: 1, period_id: 30, period_name: '第1节', subject_name: '数学', teacher_name: '张老师' },
      { weekday: 2, period_id: 31, period_name: '第2节', subject_name: '语文', teacher_name: '李老师' },
    ],
    [
      { id: 30, name: '第1节' },
      { id: 31, name: '第2节' },
    ],
  ),
  [
    {
      key: '30',
      period_id: 30,
      periodLabel: '第1节',
      day_1: '数学 / 张老师',
      day_2: '',
      day_3: '',
      day_4: '',
      day_5: '',
    },
    {
      key: '31',
      period_id: 31,
      periodLabel: '第2节',
      day_1: '',
      day_2: '语文 / 李老师',
      day_3: '',
      day_4: '',
      day_5: '',
    },
  ],
)

assert.deepEqual(
  buildSummaryCounts({
    plans: [{ subject_id: undefined }, { subject_id: 2 }],
    arrangements: [{ class_id: 1, subject_id: 2, teacher_id: 3 }, { class_id: undefined }],
    overrides: [{ class_id: undefined, subject_id: undefined }, { class_id: 1, subject_id: 2 }],
    teacherConstraints: [{ teacher_id: undefined }, { teacher_id: 8 }],
    locks: [{ class_id: undefined }, { class_id: 1, subject_id: 2, teacher_id: 3, period_id: 4 }],
  }),
  {
    plans: 1,
    arrangements: 1,
    overrides: 1,
    teacherConstraints: 1,
    locks: 1,
  },
)

assert.deepEqual(
  buildConfigWarnings({
    plans: [{ subject_id: undefined }],
    arrangements: [{ class_id: undefined, subject_id: undefined, teacher_id: undefined }],
    dirty: true,
  }),
  ['尚未配置课时计划', '尚未配置任课安排', '当前修改尚未保存'],
)

assert.deepEqual(
  findArrangementSubjectsMissingPlans({
    plans: [{ subject_id: 2 }],
    arrangements: [
      { class_id: 1, subject_id: 2, teacher_id: 10 },
      { class_id: 1, subject_id: 16, teacher_id: 11 },
      { class_id: 2, subject_id: 16, teacher_id: 12 },
      { class_id: undefined, subject_id: 18, teacher_id: 13 },
    ],
    subjects: [{ id: 16, name: 'Dao Fa' }],
  }),
  [{ subject_id: 16, subject_name: 'Dao Fa' }],
)

assert.deepEqual(
  findPlanSubjectsMissingArrangements({
    plans: [{ subject_id: 11 }, { subject_id: 17 }],
    arrangements: [
      { class_id: 1, subject_id: 11, teacher_id: 10 },
      { class_id: 2, subject_id: 18, teacher_id: 11 },
    ],
    subjects: [{ id: 17, name: 'Labor' }],
  }),
  [{ subject_id: 17, subject_name: 'Labor' }],
)

assert.deepEqual(
  findClassPlanSubjectsMissingArrangements({
    classes: [{ id: 7, name: '八七班' }, { id: 8, name: '八八班' }],
    plans: [{ subject_id: 15, weekly_hours: 1 }],
    arrangements: [{ class_id: 7, subject_id: 15, teacher_id: 12 }],
    subjects: [{ id: 15, name: '班会' }],
  }),
  [{ class_id: 8, class_name: '八八班', subject_id: 15, subject_name: '班会', weekly_hours: 1 }],
)

assert.deepEqual(
  buildConfigWarnings({
    plans: [{ subject_id: 2 }, { subject_id: 17 }],
    arrangements: [
      { class_id: 1, subject_id: 2, teacher_id: 10 },
      { class_id: 1, subject_id: 16, teacher_id: 11 },
    ],
    subjects: [{ id: 16, name: 'Dao Fa' }, { id: 17, name: 'Labor' }],
    dirty: false,
  }),
  [
    '有 1 门任课科目未配置课时规则，本次不会自动排课：Dao Fa',
    '有 1 门课时计划科目尚未配置任课安排，本次不会自动排课：Labor',
  ],
)

assert.deepEqual(
  buildConfigWarnings({
    classes: [{ id: 7, name: '八七班' }, { id: 8, name: '八八班' }],
    plans: [{ subject_id: 15, weekly_hours: 1 }],
    arrangements: [{ class_id: 7, subject_id: 15, teacher_id: 12 }],
    subjects: [{ id: 15, name: '班会' }],
    dirty: false,
  }),
  ['有 1 个班级科目缺少任课安排，本次会少排对应课时：八八班-班会 1节'],
)

assert.deepEqual(
  buildTaskSnapshot({
    task: null,
    currentDraft: null,
    draftItems: [],
  }),
  {
    tone: 'idle',
    title: '尚未生成当前草案',
    description: '保存配置后即可发起自动排课。',
    progress: 0,
    readyToPublish: false,
  },
)

assert.deepEqual(
  summarizeImportIssues([
    { issue_flags: [], teacher_match_status: 'matched' },
    { issue_flags: ['unrecognized_subject'] },
    { issue_flags: ['teacher_unmatched'] },
    { issue_flags: ['teacher_ambiguous'], teacher_match_status: 'ambiguous' },
    { issue_flags: ['teacher_time_conflict'] },
  ]),
  {
    total: 5,
    unresolved: 4,
    unrecognizedSubject: 1,
    teacherUnmatched: 1,
    teacherAmbiguous: 1,
    teacherTimeConflict: 1,
  },
)

assert.equal(canCreateImportDraft([{ issue_flags: [] }]), true)
assert.equal(canCreateImportDraft([{ issue_flags: ['teacher_unmatched'] }]), false)

const importFilterItems = [
  { id: 1, issue_flags: [] },
  { id: 2, issue_flags: ['unrecognized_subject'] },
  { id: 3, issue_flags: ['teacher_unmatched'] },
  { id: 4, issue_flags: ['teacher_ambiguous'], teacher_match_status: 'ambiguous' },
  { id: 5, issue_flags: ['teacher_time_conflict'] },
]
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'all').map((item) => item.id), [1, 2, 3, 4, 5])
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'unresolved').map((item) => item.id), [2, 3, 4, 5])
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'matched').map((item) => item.id), [1])
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'teacher_unmatched').map((item) => item.id), [3])
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'teacher_ambiguous').map((item) => item.id), [4])
assert.deepEqual(filterImportItemsByStatus(importFilterItems, 'teacher_time_conflict').map((item) => item.id), [5])

assert.match(schedulingApiSource, /request\.post\('\/api\/schedule\/imports'/)
assert.match(schedulingApiSource, /request\.get\('\/api\/schedule\/imports\/template'/)
assert.match(schedulingApiSource, /request\.get\(`\/api\/schedule\/imports\/\$\{importId\}\/items`\)/)
assert.match(schedulingApiSource, /request\.post\(`\/api\/schedule\/imports\/\$\{importId\}\/draft`\)/)
assert.match(schedulingApiSource, /exportScheduleDebugConfig/)
assert.match(schedulingApiSource, /\/api\/schedule\/debug-config\/\$\{encodeURIComponent\(grade\)\}\/export/)
assert.match(schedulingApiSource, /responseType: 'blob'/)

assert.match(scheduleManageSource, /上传已有课表/)
assert.match(scheduleManageSource, /排课流程/)
assert.match(scheduleManageSource, /准备数据/)
assert.match(scheduleManageSource, /生成草案/)
assert.match(scheduleManageSource, /复核草案/)
assert.match(scheduleManageSource, /发布生效/)
assert.match(scheduleManageSource, /补齐核心配置|开始自动排课|发布为正式课表|查看正式课表/)
assert.match(scheduleManageSource, /先补齐核心配置，再开始排课/)
assert.match(scheduleManageSource, /复核草案并决定是否发布/)
assert.match(scheduleManageSource, /草案课表/)
assert.match(scheduleManageSource, /正式课表对比/)
assert.match(scheduleManageSource, /风险清单/)
assert.match(scheduleManageSource, /workflowStage|workspaceStage/)
assert.match(scheduleManageSource, /task\?\.status === 'failed'/)
assert.match(scheduleManageSource, /<Alert type="error" showIcon message=\{taskSnapshot\.title\} description=\{taskSnapshot\.description\}/)
assert.match(scheduleManageSource, /导出调试包/)
assert.match(scheduleManageSource, /handleExportDebugConfig/)
assert.match(scheduleManageSource, /请先保存配置后再导出调试包/)
assert.match(scheduleManageSource, /schedule-debug-\$\{grade\}-\$\{timestamp\}\.json/)
assert.match(scheduleManageSource, /待确认草案/)
assert.match(scheduleManageSource, /正式课表尚未变更/)
assert.match(scheduleManageSource, /只支持 Excel 课表/)
assert.match(scheduleManageSource, /下载Excel模板/)
assert.match(scheduleManageSource, /importGrade/)
assert.match(scheduleManageSource, /目标年级/)
assert.match(scheduleManageSource, /formData\.append\('grade', importGrade\)/)
assert.match(scheduleManageSource, /每个 sheet 名应对应一个班级/)
assert.match(scheduleManageSource, /请先创建科目/)
assert.match(scheduleManageSource, /创建教师账号/)
assert.match(scheduleManageSource, /绑定教师-班级-科目/)
assert.match(scheduleManageSource, /状态筛选/)
assert.match(scheduleManageSource, /importStatusFilter/)
assert.match(scheduleManageSource, /教师时间冲突/)
assert.match(scheduleManageSource, /conflict_items/)
assert.match(scheduleManageSource, /zIndex=\{1300\}/)
assert.match(scheduleManageSource, /课表中只有科目时/)
assert.match(scheduleManageSource, /先到“班级-科目-教师分配”/)
assert.match(scheduleManageSource, /function handleViewImportDraft\(\)/)
assert.match(scheduleManageSource, /pendingDraftScrollRef\.current = true/)
assert.match(scheduleManageSource, /setActiveTab\('draft'\)[\s\S]*setImportOpen\(false\)/)
assert.match(scheduleManageSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
assert.match(scheduleManageSource, /<div ref=\{draftSectionRef\}>/)
assert.match(scheduleManageSource, /filteredImportItems/)
assert.doesNotMatch(scheduleManageSource, /年级总课表（暂未开放）/)
assert.doesNotMatch(scheduleManageSource, /图片课表/)
assert.doesNotMatch(scheduleManageSource, /OCR/)

assert.deepEqual(
  buildTaskSnapshot({
    task: { status: 'pending', progress: 32, message: '正在计算冲突' },
    currentDraft: null,
    draftItems: [],
  }),
  {
    tone: 'processing',
    title: '排课引擎正在生成当前草案',
    description: '正在计算冲突',
    progress: 32,
    readyToPublish: false,
  },
)

assert.deepEqual(
  buildTaskSnapshot({
    task: {
      status: 'failed',
      progress: 100,
      error: '排课模型校验失败',
      result: {
        diagnostics: [
          { code: 'class_capacity_exceeded', message: '班级 1 需要排 36 节课，但可用课位只有 35 个' },
        ],
      },
    },
    currentDraft: null,
    draftItems: [],
  }),
  {
    tone: 'danger',
    title: '排课任务失败',
    description: '班级 1 需要排 36 节课，但可用课位只有 35 个',
    progress: 100,
    readyToPublish: false,
  },
)

assert.deepEqual(
  buildTaskSnapshot({
    task: { status: 'success', progress: 100 },
    currentDraft: {
      score: 96,
      summary: {
        locked_hits: 8,
        locked_total: 8,
        risk_count: 1,
      },
    },
    draftItems: [{}, {}, {}],
  }),
  {
    tone: 'success',
    title: '当前草案已生成',
    description: '得分 96，锁定命中 8/8，风险 1，草案课位 3 条。',
    progress: 100,
    readyToPublish: true,
  },
)

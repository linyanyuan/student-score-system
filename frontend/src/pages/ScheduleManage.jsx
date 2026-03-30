import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

import request from '../api/request'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import {
  createAutoScheduleTask,
  getClassTimetable,
  getLessonPlan,
  getScheduleTask,
  getTeachingArrangement,
  saveLessonPlan,
  saveTeachingArrangement,
} from '../api/scheduling'

const { Title, Text } = Typography

const DEFAULT_PLAN_ROW = {
  subject_id: undefined,
  weekly_hours: 1,
  priority: 1,
  avoid_consecutive: false,
  forbidden_periods_text: '',
}

const DEFAULT_ARR_ROW = {
  class_id: undefined,
  subject_id: undefined,
  teacher_id: undefined,
}

const STATUS_LABEL = {
  pending: '排队中',
  running: '排课中',
  success: '成功',
  failed: '失败',
}

function formatStatus(status) {
  return STATUS_LABEL[status] || status || '-'
}


function parseForbiddenPeriods(text) {
  if (!text?.trim()) return []
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [weekday, period] = pair.split('-').map((n) => Number(n))
      if (!Number.isInteger(weekday) || !Number.isInteger(period)) return null
      return [weekday, period]
    })
    .filter(Boolean)
}

function formatForbiddenPeriods(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return ''
  return periods.map((p) => `${p[0]}-${p[1]}`).join(',')
}

function buildPreviewRows(items) {
  const periods = Array.from(new Set(items.map((i) => i.period_id))).sort((a, b) => a - b)
  return periods.map((periodId) => {
    const row = { period_id: periodId, period: `第${periodId}节` }
    for (let day = 1; day <= 5; day += 1) {
      const hit = items.find((i) => i.period_id === periodId && i.weekday === day)
      row[`day_${day}`] = hit ? `${hit.subject_name || '-'} (${hit.teacher_name || '-'})` : ''
    }
    return row
  })
}

export default function ScheduleManage() {
  const [grade, setGrade] = useState('高一')
  const [plans, setPlans] = useState([{ ...DEFAULT_PLAN_ROW }])
  const [arrangements, setArrangements] = useState([{ ...DEFAULT_ARR_ROW }])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState(null)
  const [previewClassId, setPreviewClassId] = useState(null)
  const [previewRows, setPreviewRows] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const pollingRef = useRef(null)

  const subjectOptions = useMemo(() => subjects.map((s) => ({ label: s.name, value: s.id })), [subjects])
  const classOptions = useMemo(() => classes.map((c) => ({ label: `${c.grade}-${c.name}`, value: c.id })), [classes])
  const teacherOptions = useMemo(() => teachers.map((t) => ({ label: t.username, value: t.id })), [teachers])
  const gradeRankMap = useMemo(
    () => ({
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
    }),
    []
  )
  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((c) => c.grade).filter(Boolean)))
        .sort((a, b) => (gradeRankMap[a] ?? 999) - (gradeRankMap[b] ?? 999) || a.localeCompare(b, 'zh-Hans-CN'))
        .map((item) => ({ label: item, value: item })),
    [classes, gradeRankMap]
  )
  const gradeClassOptions = useMemo(
    () => classes.filter((c) => c.grade === grade).map((c) => ({ label: `${c.grade}-${c.name}`, value: c.id })),
    [classes, grade]
  )

  const previewColumns = useMemo(
    () => [
      { title: '节次', dataIndex: 'period', key: 'period', width: 100 },
      { title: '周一', dataIndex: 'day_1', key: 'day_1' },
      { title: '周二', dataIndex: 'day_2', key: 'day_2' },
      { title: '周三', dataIndex: 'day_3', key: 'day_3' },
      { title: '周四', dataIndex: 'day_4', key: 'day_4' },
      { title: '周五', dataIndex: 'day_5', key: 'day_5' },
    ],
    []
  )

  const loadClassPreview = async (classId) => {
    if (!classId) {
      setPreviewRows([])
      return
    }
    setPreviewLoading(true)
    try {
      const res = await getClassTimetable(classId)
      const rows = buildPreviewRows(res.data?.items || [])
      setPreviewRows(rows)
    } catch (err) {
      message.error(err.message || '加载课表预览失败')
      setPreviewRows([])
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const [classRes, subjectRes, teacherRes] = await Promise.all([
          getClasses(),
          getSubjects(),
          request.get('/api/auth/teachers'),
        ])
        setClasses(classRes.data || [])
        setSubjects(subjectRes.data || [])
        setTeachers(teacherRes.data || [])
      } catch (err) {
        message.error(err.message || '加载基础数据失败')
      }
    })()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  useEffect(() => {
    if (gradeOptions.length === 0) return
    if (!grade || !gradeOptions.some((item) => item.value === grade)) {
      setGrade(gradeOptions[0].value)
    }
  }, [gradeOptions, grade])

  const loadGradeConfig = async () => {
    if (!grade?.trim()) return
    setLoading(true)
    try {
      const [planRes, arrRes] = await Promise.all([getLessonPlan(grade.trim()), getTeachingArrangement(grade.trim())])

      const planItems = (planRes.data?.items || []).map((item) => ({
        ...item,
        forbidden_periods_text: formatForbiddenPeriods(item.forbidden_periods),
      }))
      setPlans(planItems.length ? planItems : [{ ...DEFAULT_PLAN_ROW }])

      const arrItems = arrRes.data?.items || []
      setArrangements(arrItems.length ? arrItems : [{ ...DEFAULT_ARR_ROW }])
      message.success('已加载配置')
    } catch (err) {
      message.error(err.message || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const submitLessonPlan = async () => {
    const payload = {
      grade: grade.trim(),
      items: plans
        .filter((row) => row.subject_id)
        .map((row) => ({
          subject_id: row.subject_id,
          weekly_hours: Number(row.weekly_hours || 0),
          priority: Number(row.priority || 1),
          avoid_consecutive: !!row.avoid_consecutive,
          forbidden_periods: parseForbiddenPeriods(row.forbidden_periods_text),
        })),
    }
    try {
      await saveLessonPlan(payload)
      message.success('课时计划已保存')
    } catch (err) {
      message.error(err.message || '保存课时计划失败')
    }
  }

  const submitArrangement = async () => {
    const payload = {
      grade: grade.trim(),
      items: arrangements
        .filter((row) => row.class_id && row.subject_id && row.teacher_id)
        .map((row) => ({
          class_id: row.class_id,
          subject_id: row.subject_id,
          teacher_id: row.teacher_id,
        })),
    }
    try {
      await saveTeachingArrangement(payload)
      message.success('授课安排已保存')
    } catch (err) {
      message.error(err.message || '保存授课安排失败')
    }
  }

  const startSchedule = async () => {
    try {
      const res = await createAutoScheduleTask(grade.trim())
      const taskId = res.data.task_id
      setTask({ id: taskId, status: res.data.status, progress: 0, message: '排队中' })

      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(async () => {
        try {
          const taskRes = await getScheduleTask(taskId)
          const next = taskRes.data
          setTask(next)
          if (next.status === 'success' || next.status === 'failed') {
            clearInterval(pollingRef.current)
            pollingRef.current = null
            if (next.status === 'success') {
              const firstClass = gradeClassOptions[0]?.value
              if (firstClass) {
                setPreviewClassId(firstClass)
                loadClassPreview(firstClass)
              }
            }
          }
        } catch (err) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
          message.error(err.message || '轮询任务失败')
        }
      }, 2000)
      message.success(`任务已创建: #${taskId}`)
    } catch (err) {
      message.error(err.message || '触发排课失败')
    }
  }

  const planColumns = [
    {
      title: '科目',
      dataIndex: 'subject_id',
      render: (_, row, idx) => (
        <Select
          value={row.subject_id}
          options={subjectOptions}
          style={{ width: '100%' }}
          onChange={(value) => {
            const next = [...plans]
            next[idx] = { ...next[idx], subject_id: value }
            setPlans(next)
          }}
        />
      ),
    },
    {
      title: '周课时',
      dataIndex: 'weekly_hours',
      width: 120,
      render: (_, row, idx) => (
        <InputNumber
          min={0}
          max={10}
          value={row.weekly_hours}
          onChange={(value) => {
            const next = [...plans]
            next[idx] = { ...next[idx], weekly_hours: value }
            setPlans(next)
          }}
        />
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 120,
      render: (_, row, idx) => (
        <InputNumber
          min={1}
          max={10}
          value={row.priority}
          onChange={(value) => {
            const next = [...plans]
            next[idx] = { ...next[idx], priority: value }
            setPlans(next)
          }}
        />
      ),
    },
    {
      title: '禁连堂',
      dataIndex: 'avoid_consecutive',
      width: 120,
      render: (_, row, idx) => (
        <Switch
          checked={!!row.avoid_consecutive}
          onChange={(checked) => {
            const next = [...plans]
            next[idx] = { ...next[idx], avoid_consecutive: checked }
            setPlans(next)
          }}
        />
      ),
    },
    {
      title: (
        <Space size={4}>
          <span>禁排</span>
          <Tooltip title="格式：周-节，多个用英文逗号分隔。示例：1-1,1-2,5-6。">
            <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'forbidden_periods_text',
      render: (_, row, idx) => (
        <Input
          value={row.forbidden_periods_text}
          placeholder="例如: 1-1,5-6"
          onChange={(e) => {
            const next = [...plans]
            next[idx] = { ...next[idx], forbidden_periods_text: e.target.value }
            setPlans(next)
          }}
        />
      ),
    },
  ]

  const arrangementColumns = [
    {
      title: '班级',
      dataIndex: 'class_id',
      render: (_, row, idx) => (
        <Select
          value={row.class_id}
          options={classOptions}
          style={{ width: '100%' }}
          onChange={(value) => {
            const next = [...arrangements]
            next[idx] = { ...next[idx], class_id: value }
            setArrangements(next)
          }}
        />
      ),
    },
    {
      title: '科目',
      dataIndex: 'subject_id',
      render: (_, row, idx) => (
        <Select
          value={row.subject_id}
          options={subjectOptions}
          style={{ width: '100%' }}
          onChange={(value) => {
            const next = [...arrangements]
            next[idx] = { ...next[idx], subject_id: value }
            setArrangements(next)
          }}
        />
      ),
    },
    {
      title: '教师',
      dataIndex: 'teacher_id',
      render: (_, row, idx) => (
        <Select
          value={row.teacher_id}
          options={teacherOptions}
          style={{ width: '100%' }}
          onChange={(value) => {
            const next = [...arrangements]
            next[idx] = { ...next[idx], teacher_id: value }
            setArrangements(next)
          }}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: 8 }}>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>使用说明</Title>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          <li>先选择或输入年级，点击“加载配置”读取该年级已有的课时计划和授课安排。</li>
          <li>在“课时计划”里设置每个科目的周课时、优先级和禁排规则，并保存。</li>
          <li>在“授课安排”里配置班级-科目-教师关系，并保存。</li>
          <li>确认配置后点击右上角“开始排课”，系统会自动生成课表并展示任务状态。</li>
          <li>排课成功后可在“课表预览”中按班级查看结果。</li>
          <li>禁排规则格式：周-节，多个规则用英文逗号分隔，例如：1-1,1-2,5-6。</li>
        </ul>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle" wrap={false}>
          <Col flex="none">
            <Text strong>年级</Text>
          </Col>
          <Col flex="220px">
            {gradeOptions.length > 0 ? (
              <Select
                value={grade}
                options={gradeOptions}
                style={{ width: '100%' }}
                placeholder="请选择年级"
                showSearch
                optionFilterProp="label"
                onChange={(value) => setGrade(value)}
              />
            ) : (
              <Input
                value={grade}
                style={{ width: '100%' }}
                placeholder="可手动输入年级，如八年级"
                onChange={(e) => setGrade(e.target.value)}
              />
            )}
          </Col>
          <Col flex="none">
            <Button onClick={loadGradeConfig} loading={loading}>加载配置</Button>
          </Col>
          <Col flex="auto">
            <Card
            extra={
              <Space>
              <Button type="primary" onClick={startSchedule} style={{ minWidth: 108 }}>开始排课</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table rowKey={(_, idx) => `plan-${idx}`} pagination={false} dataSource={plans} columns={planColumns} />
          </Card>
          </Col>
        </Row>
      </Card>

      {gradeOptions.length === 0 && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          当前未读取到可选年级，可手动输入；如需下拉候选，请先在“班级管理”维护班级年级数据。
        </Text>
      )}

      {task && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Tag color={task.status === 'success' ? 'green' : task.status === 'failed' ? 'red' : 'blue'}>
              {formatStatus(task.status)}
            </Tag>
            <Text>任务 #{task.id}</Text>
            <Text>进度 {task.progress ?? 0}%</Text>
            <Text>{task.message || '-'}</Text>
          </Space>
        </Card>
      )}

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>课时计划</Title>}
            extra={
              <Space>
                <Button onClick={() => setPlans([...plans, { ...DEFAULT_PLAN_ROW }])}>新增行</Button>
                <Button type="primary" onClick={submitLessonPlan}>保存课时计划</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table rowKey={(_, idx) => `plan-${idx}`} pagination={false} dataSource={plans} columns={planColumns} />
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>授课安排</Title>}
            extra={
              <Space>
                <Button onClick={() => setArrangements([...arrangements, { ...DEFAULT_ARR_ROW }])}>新增行</Button>
                <Button type="primary" onClick={submitArrangement}>保存授课安排</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table rowKey={(_, idx) => `arr-${idx}`} pagination={false} dataSource={arrangements} columns={arrangementColumns} />
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>课表预览</Title>}
            extra={
              <Space>
                <Select
                  value={previewClassId}
                  placeholder="选择班级"
                  options={gradeClassOptions}
                  style={{ width: 220 }}
                  onChange={(value) => {
                    setPreviewClassId(value)
                    loadClassPreview(value)
                  }}
                />
                <Button onClick={() => loadClassPreview(previewClassId)} disabled={!previewClassId}>刷新预览</Button>
              </Space>
            }
          >
            <Table
              rowKey="period_id"
              loading={previewLoading}
              pagination={false}
              dataSource={previewRows}
              columns={previewColumns}
              locale={{ emptyText: '暂无课表数据（排课成功后可预览）' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}



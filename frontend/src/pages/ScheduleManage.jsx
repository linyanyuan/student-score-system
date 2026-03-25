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
  Typography,
} from 'antd'

import request from '../api/request'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import {
  createAutoScheduleTask,
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

export default function ScheduleManage() {
  const [grade, setGrade] = useState('高一')
  const [plans, setPlans] = useState([{ ...DEFAULT_PLAN_ROW }])
  const [arrangements, setArrangements] = useState([{ ...DEFAULT_ARR_ROW }])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState(null)

  const pollingRef = useRef(null)

  const subjectOptions = useMemo(() => subjects.map((s) => ({ label: s.name, value: s.id })), [subjects])
  const classOptions = useMemo(() => classes.map((c) => ({ label: `${c.grade}-${c.name}`, value: c.id })), [classes])
  const teacherOptions = useMemo(() => teachers.map((t) => ({ label: t.username, value: t.id })), [teachers])

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
      setTask({ id: taskId, status: res.data.status, progress: 0, message: 'queued' })

      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(async () => {
        try {
          const taskRes = await getScheduleTask(taskId)
          const next = taskRes.data
          setTask(next)
          if (next.status === 'success' || next.status === 'failed') {
            clearInterval(pollingRef.current)
            pollingRef.current = null
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
      title: '禁排(周-节,逗号分隔)',
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
      <Space style={{ marginBottom: 16 }}>
        <Text>年级</Text>
        <Input value={grade} onChange={(e) => setGrade(e.target.value)} style={{ width: 160 }} />
        <Button onClick={loadGradeConfig} loading={loading}>加载配置</Button>
        <Button type="primary" onClick={startSchedule}>开始排课</Button>
      </Space>

      {task && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Tag color={task.status === 'success' ? 'green' : task.status === 'failed' ? 'red' : 'blue'}>
              {task.status}
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
          >
            <Table rowKey={(_, idx) => `arr-${idx}`} pagination={false} dataSource={arrangements} columns={arrangementColumns} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

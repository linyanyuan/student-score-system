import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, CalendarOutlined, TeamOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getExams, createExam, updateExam, deleteExam } from '../api/exam'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'

const GRADE_OPTIONS = ['七年级', '八年级', '九年级', '高一', '高二', '高三']
const GRADE_RANK = Object.fromEntries(GRADE_OPTIONS.map((grade, index) => [grade, index + 1]))

const compareGrade = (left, right) =>
  (GRADE_RANK[left] ?? 999) - (GRADE_RANK[right] ?? 999) || String(left || '').localeCompare(String(right || ''), 'zh-Hans-CN')

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
}

const filterRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'center',
  justifyContent: 'space-between',
}

const filterGroupStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const filterLabelStyle = {
  fontSize: 13,
  color: 'var(--workspace-muted)',
}

export default function ExamManage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [gradeFilter, setGradeFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getExams()
      setData(res.data)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        exam_date: values.exam_date.format('YYYY-MM-DD'),
        grade: Array.isArray(values.grade) ? values.grade.join(',') : values.grade,
      }
      if (editing) {
        await updateExam(editing.id, payload)
        message.success('修改成功')
      } else {
        await createExam(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      fetchData()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteExam(id)
      message.success('删除成功')
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const normalizedGrades = (record) => (record.grade || '').split(',').map((item) => item.trim()).filter(Boolean)

  const sortedRows = [...data].sort(
    (left, right) => dayjs(left.exam_date).valueOf() - dayjs(right.exam_date).valueOf(),
  )
  const allGrades = Array.from(
    new Set(data.flatMap((record) => normalizedGrades(record))),
  ).sort(compareGrade)
  const activeGradeFilter = gradeFilter && allGrades.includes(gradeFilter) ? gradeFilter : ''
  const normalizedKeyword = keyword.trim().toLowerCase()
  const nextExam = sortedRows.find((item) => !dayjs(item.exam_date).isBefore(dayjs(), 'day'))
  const gradeCoverage = new Set(data.flatMap((item) => normalizedGrades(item))).size

  const filteredRows = sortedRows.filter((item) => {
    const grades = normalizedGrades(item)
    const haystack = `${item.name || ''} ${item.description || ''}`.toLowerCase()
    const matchesGrade = !activeGradeFilter || grades.includes(activeGradeFilter)
    const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword)
    return matchesGrade && matchesKeyword
  })

  const metrics = [
    {
      key: 'total',
      icon: <CalendarOutlined />,
      label: '考试总数',
      value: data.length,
      helper: data.length ? '当前已录入考试安排' : '暂无考试安排',
      accent: { background: '#e9f2ff', color: '#1d4ed8' },
    },
    {
      key: 'next',
      icon: <FilterOutlined />,
      label: '最近一场考试',
      value: nextExam ? dayjs(nextExam.exam_date).format('MM-DD') : '--',
      helper: nextExam ? `${nextExam.name}` : '暂未安排未来考试',
      accent: { background: '#fff7e6', color: '#b45309' },
    },
    {
      key: 'coverage',
      icon: <TeamOutlined />,
      label: '覆盖年级',
      value: gradeCoverage,
      helper: gradeCoverage ? `覆盖 ${allGrades.join('、')}` : '尚未配置参与年级',
      accent: { background: '#eff8ef', color: '#18794e' },
    },
  ]

  const emptyCopy = data.length === 0
    ? '暂无考试数据，请先新建考试。'
    : '没有匹配的考试，请调整筛选条件。'

  useEffect(() => {
    if (!gradeFilter) return
    if (!allGrades.includes(gradeFilter)) {
      setGradeFilter('')
    }
  }, [gradeFilter, allGrades])

  const columns = [
    { title: '考试名称', dataIndex: 'name', key: 'name' },
    {
      title: '考试日期',
      dataIndex: 'exam_date',
      key: 'exam_date',
      width: 140,
      render: (value) => (
        <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
      ),
    },
    {
      title: '参与年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 200,
      render: (_, record) => {
        const grades = normalizedGrades(record)
        if (grades.length === 0) return <Tag color="warning">未设置参与年级</Tag>
        return grades.map((grade) => <Tag key={grade}>{grade}</Tag>)
      },
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => {
            setEditing(record)
            form.setFieldsValue({
              ...record,
              exam_date: dayjs(record.exam_date),
              grade: record.grade ? record.grade.split(',') : [],
            })
            setModalOpen(true)
          }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Exam Workspace"
        title="考试管理"
        description="集中维护考试时间、参与年级与考试说明，保持考试安排可追踪、可检索。"
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>
            新建考试
          </Button>
        )}
        meta={(
          <Space size={12} wrap>
            <span>已加载 {data.length} 场考试</span>
            <span>覆盖 {gradeCoverage} 个年级</span>
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

      <WorkspaceSectionCard
        eyebrow="Exam Timeline"
        title="考试列表"
        description="按参与年级过滤并按考试名称搜索，快速查看当前考试安排。"
      >
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>按参与年级过滤</span>
              <Select
                style={{ minWidth: 170 }}
                allowClear
                placeholder="选择年级"
                value={gradeFilter || undefined}
                options={allGrades.map((grade) => ({ label: grade, value: grade }))}
                onChange={(value) => setGradeFilter(value || '')}
              />
            </div>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>按考试名称搜索</span>
              <Input
                allowClear
                value={keyword}
                placeholder="输入考试名称或描述"
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </div>
          <div style={filterGroupStyle}>
            <span style={filterLabelStyle}>当前结果 {filteredRows.length} 条</span>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRows}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: emptyCopy }}
        />
      </WorkspaceSectionCard>

      <Modal
        title={editing ? '编辑考试信息' : '新建考试'}
        open={modalOpen}
        onOk={handleOk}
        okText={editing ? '保存修改' : '创建考试'}
        cancelText="取消"
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="如：2026年期中考试" />
          </Form.Item>
          <Form.Item name="exam_date" label="考试日期" rules={[{ required: true, message: '请选择考试日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="grade" label="参与年级" rules={[{ required: true, message: '请选择参与年级' }]}>
            <Select mode="multiple" placeholder="选择参与年级（可多选）" allowClear>
              {GRADE_OPTIONS.map((grade) => <Select.Option key={grade} value={grade}>{grade}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

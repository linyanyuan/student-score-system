import { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { CalendarOutlined, FilterOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { createExam, deleteExam, getExams, updateExam } from '../api/exam'
import { getSubjects } from '../api/subject'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'

const GRADE_OPTIONS = ['七年级', '八年级', '九年级', '高一', '高二', '高三']
const GRADE_RANK = Object.fromEntries(GRADE_OPTIONS.map((grade, index) => [grade, index + 1]))

const compareGrade = (left, right) =>
  (GRADE_RANK[left] ?? 999) - (GRADE_RANK[right] ?? 999) || String(left || '').localeCompare(String(right || ''), 'zh-Hans-CN')

const parseGradeTokens = (value) =>
  String(value || '')
    .replaceAll('，', ',')
    .replaceAll('、', ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseSubjectGrades = (value) => parseGradeTokens(value)

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

function gradeSupportsSubject(subject, grade) {
  const grades = parseSubjectGrades(subject?.grades)
  if (grades.length === 0) return true
  return grades.includes(grade)
}

function renderGradeSubjectSummary(record) {
  const groups = Array.isArray(record?.grade_subjects) ? record.grade_subjects : []
  if (groups.length === 0) return <Tag color="warning">未配置考试科目</Tag>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {groups.map((group) => {
        const subjectNames = (group.subjects || []).map((item) => item.name).filter(Boolean)
        return (
          <div key={group.grade}>
            <Tag color="blue">{group.grade}</Tag>
            <span>{subjectNames.join('、') || '未配置科目'}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function ExamManage() {
  const [data, setData] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [gradeFilter, setGradeFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedGrades, setSelectedGrades] = useState([])
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [examRes, subjectRes] = await Promise.all([getExams(), getSubjects()])
      setData(examRes.data || [])
      setSubjects(subjectRes.data || [])
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const normalizedGrades = (record) => parseGradeTokens(record?.grade)

  const allGrades = useMemo(
    () => Array.from(new Set(data.flatMap((record) => normalizedGrades(record)))).sort(compareGrade),
    [data],
  )

  useEffect(() => {
    if (!gradeFilter) return
    if (!allGrades.includes(gradeFilter)) setGradeFilter('')
  }, [gradeFilter, allGrades])

  const activeGradeFilter = gradeFilter && allGrades.includes(gradeFilter) ? gradeFilter : ''
  const normalizedKeyword = keyword.trim().toLowerCase()
  const sortedRows = [...data].sort((left, right) => dayjs(left.exam_date).valueOf() - dayjs(right.exam_date).valueOf())
  const filteredRows = sortedRows.filter((item) => {
    const grades = normalizedGrades(item)
    const haystack = `${item.name || ''} ${item.description || ''}`.toLowerCase()
    const matchesGrade = !activeGradeFilter || grades.includes(activeGradeFilter)
    const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword)
    return matchesGrade && matchesKeyword
  })

  const nextExam = sortedRows.find((item) => !dayjs(item.exam_date).isBefore(dayjs(), 'day'))
  const gradeCoverage = new Set(data.flatMap((item) => normalizedGrades(item))).size

  const resetModal = () => {
    setModalOpen(false)
    setEditing(null)
    setSelectedGrades([])
    form.resetFields()
  }

  const handleOpenCreate = () => {
    setEditing(null)
    setSelectedGrades([])
    form.resetFields()
    form.setFieldValue('grade_subjects', {})
    setModalOpen(true)
  }

  const handleOpenEdit = (record) => {
    setEditing(record)
    const grade_subjects = Object.fromEntries((record.grade_subjects || []).map((item) => [item.grade, item.subject_ids || []]))
    const grades = normalizedGrades(record)
    setSelectedGrades(grades)
    form.setFieldsValue({
      ...record,
      exam_date: dayjs(record.exam_date),
      grade: grades,
      grade_subjects,
    })
    setModalOpen(true)
  }

  const handleGradeChange = (grades = []) => {
    setSelectedGrades(grades)
    const currentMap = form.getFieldValue('grade_subjects') || {}
    const nextMap = Object.fromEntries(grades.map((grade) => [grade, currentMap[grade] || []]))
    form.setFieldValue('grade_subjects', nextMap)
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const grade_subjects = selectedGrades.map((grade) => ({
        grade,
        subject_ids: (values.grade_subjects?.[grade] || []).filter(Boolean),
      }))
      if (grade_subjects.some((item) => item.subject_ids.length === 0)) {
        message.warning('请为每个参与年级选择考试科目')
        return
      }
      const payload = {
        name: values.name,
        exam_date: values.exam_date.format('YYYY-MM-DD'),
        grade: values.grade.join(','),
        description: values.description,
        grade_subjects,
      }

      if (editing) {
        await updateExam(editing.id, payload)
        message.success('修改成功')
      } else {
        await createExam(payload)
        message.success('创建成功')
      }
      resetModal()
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
      helper: nextExam ? nextExam.name : '暂未安排未来考试',
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

  const columns = [
    { title: '考试名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: '考试日期',
      dataIndex: 'exam_date',
      key: 'exam_date',
      width: 140,
      render: (value) => <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</span>,
    },
    {
      title: '参与年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 180,
      render: (_, record) => {
        const grades = normalizedGrades(record)
        if (grades.length === 0) return <Tag color="warning">未设置参与年级</Tag>
        return grades.map((grade) => <Tag key={grade}>{grade}</Tag>)
      },
    },
    {
      title: '年级考试科目',
      key: 'grade_subjects',
      render: (_, record) => renderGradeSubjectSummary(record),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, width: 220 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleOpenEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？该考试已录入的成绩也会一并删除。" onConfirm={() => handleDelete(record.id)}>
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
        description="集中维护考试时间、参与年级和各年级考试科目，保证成绩录入与导出都基于同一份考试配置。"
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
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
        description="按参与年级过滤并按考试名称搜索，直接查看各年级在这场考试中的考试科目。"
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
            <Input
              allowClear
              value={keyword}
              placeholder="输入考试名称或描述"
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              onChange={(event) => setKeyword(event.target.value)}
            />
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
          locale={{ emptyText: data.length === 0 ? '暂无考试数据，请先新建考试。' : '没有匹配的考试，请调整筛选条件。' }}
          scroll={{ x: 1100 }}
        />
      </WorkspaceSectionCard>

      <Modal
        title={editing ? '编辑考试信息' : '新建考试'}
        open={modalOpen}
        onOk={handleOk}
        okText={editing ? '保存修改' : '创建考试'}
        cancelText="取消"
        onCancel={resetModal}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="如：2026年期中考试" />
          </Form.Item>
          <Form.Item name="exam_date" label="考试日期" rules={[{ required: true, message: '请选择考试日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="grade" label="参与年级" rules={[{ required: true, message: '请选择参与年级' }]}>
            <Select
              mode="multiple"
              placeholder="选择参与年级（可多选）"
              allowClear
              options={GRADE_OPTIONS.map((grade) => ({ label: grade, value: grade }))}
              onChange={handleGradeChange}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <div>
                {selectedGrades.map((grade) => {
                  const gradeSubjectOptions = subjects
                    .filter((subject) => gradeSupportsSubject(subject, grade))
                    .map((subject) => ({ label: subject.name, value: subject.id }))

                  return (
                    <Form.Item
                      key={grade}
                      name={['grade_subjects', grade]}
                      label={`${grade}考试科目`}
                      rules={[{ required: true, message: `请选择${grade}考试科目` }]}
                    >
                      <Select
                        mode="multiple"
                        allowClear
                        optionFilterProp="label"
                        placeholder={`选择${grade}考试科目`}
                        options={gradeSubjectOptions}
                      />
                    </Form.Item>
                  )
                })}
              </div>
            )}
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

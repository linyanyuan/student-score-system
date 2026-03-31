import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, BookOutlined, ReadOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../api/subject'
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

export default function SubjectManage() {
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
      const res = await getSubjects()
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
        grades: values.grades?.length ? values.grades.join(',') : null,
      }
      if (editing) {
        await updateSubject(editing.id, payload)
        message.success('修改成功')
      } else {
        await createSubject(payload)
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
      await deleteSubject(id)
      message.success('删除成功')
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const normalizedGrades = (record) => (record.grades || '').split(',').map((item) => item.trim()).filter(Boolean)

  const gradeOptions = Array.from(
    new Set(data.flatMap((record) => normalizedGrades(record))),
  ).sort(compareGrade)

  const activeGradeFilter = gradeFilter && gradeOptions.includes(gradeFilter) ? gradeFilter : ''
  const normalizedKeyword = keyword.trim().toLowerCase()
  const uncoveredCount = data.filter((record) => normalizedGrades(record).length === 0).length

  const filteredRows = data.filter((item) => {
    const grades = normalizedGrades(item)
    const haystack = `${item.name || ''} ${item.code || ''}`.toLowerCase()
    const matchesGrade = !activeGradeFilter || grades.includes(activeGradeFilter)
    const matchesKeyword = !normalizedKeyword || haystack.includes(normalizedKeyword)
    return matchesGrade && matchesKeyword
  })

  const metrics = [
    {
      key: 'total',
      icon: <BookOutlined />,
      label: '科目总数',
      value: data.length,
      helper: data.length ? '当前学年可用科目数量' : '暂未配置科目',
      accent: { background: '#e9f2ff', color: '#1d4ed8' },
    },
    {
      key: 'coverage',
      icon: <ReadOutlined />,
      label: '适用年级',
      value: gradeOptions.length,
      helper: gradeOptions.length ? `覆盖 ${gradeOptions.join('、')}` : '尚未分配适用年级',
      accent: { background: '#eff8ef', color: '#18794e' },
    },
    {
      key: 'uncovered',
      icon: <FilterOutlined />,
      label: '未分配适用年级',
      value: uncoveredCount,
      helper: uncoveredCount ? '建议尽快补齐覆盖范围' : '科目覆盖保持完整',
      accent: { background: '#fff7e6', color: '#b45309' },
    },
  ]

  const emptyCopy = data.length === 0
    ? '暂无科目数据，请先新建科目。'
    : '没有匹配的科目，请调整筛选条件。'

  useEffect(() => {
    if (!gradeFilter) return
    if (!gradeOptions.includes(gradeFilter)) {
      setGradeFilter('')
    }
  }, [gradeFilter, gradeOptions])

  const columns = [
    { title: '科目名称', dataIndex: 'name', key: 'name' },
    { title: '科目代码', dataIndex: 'code', key: 'code' },
    {
      title: '适用年级',
      dataIndex: 'grades',
      key: 'grades',
      render: (_, record) => {
        const grades = normalizedGrades(record)
        if (grades.length === 0) {
          return <Tag color="warning">未分配适用年级</Tag>
        }
        return grades.map((grade) => <Tag key={grade}>{grade}</Tag>)
      },
    },
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
              grades: record.grades ? record.grades.split(',') : [],
            })
            setModalOpen(true)
          }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}><Button size="small" danger>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Subject Workspace"
        title="科目管理"
        description="维护科目编码与适用年级范围，统一支撑排课与考试的基础配置。"
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>
            新建科目
          </Button>
        )}
        meta={(
          <Space size={12} wrap>
            <span>已加载 {data.length} 门科目</span>
            <span>覆盖 {gradeOptions.length} 个年级</span>
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
        eyebrow="Subject Directory"
        title="科目列表"
        description="按适用年级筛选并按名称或代码搜索，快速定位目标科目并执行维护。"
      >
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>按适用年级筛选</span>
              <Select
                style={{ minWidth: 170 }}
                allowClear
                placeholder="选择年级"
                value={gradeFilter || undefined}
                options={gradeOptions.map((grade) => ({ label: grade, value: grade }))}
                onChange={(value) => setGradeFilter(value || '')}
              />
            </div>
            <div style={filterGroupStyle}>
              {/* <span style={filterLabelStyle}>按名称或代码搜索</span> */}
              <Input
                allowClear
                value={keyword}
                placeholder="输入科目名称或代码"
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
        title={editing ? '编辑科目信息' : '新建科目'}
        open={modalOpen}
        onOk={handleOk}
        okText={editing ? '保存修改' : '创建科目'}
        cancelText="取消"
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="科目名称" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input placeholder="如：数学" />
          </Form.Item>
          <Form.Item name="code" label="科目代码" rules={[{ required: true, message: '请输入科目代码' }]}>
            <Input placeholder="如：MATH" />
          </Form.Item>
          <Form.Item name="grades" label="适用年级">
            <Select mode="multiple" placeholder="选择适用年级（可多选）" allowClear>
              {GRADE_OPTIONS.map((grade) => <Select.Option key={grade} value={grade}>{grade}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

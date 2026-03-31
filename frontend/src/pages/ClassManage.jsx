import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select } from 'antd'
import { PlusOutlined, TeamOutlined, ApartmentOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { getClasses, createClass, updateClass, deleteClass } from '../api/class'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'

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

export default function ClassManage() {
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
      const res = await getClasses()
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
      if (editing) {
        await updateClass(editing.id, values)
        message.success('修改成功')
      } else {
        await createClass(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      fetchData()
    } catch (err) {
      if (err.message) message.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteClass(id)
      message.success('删除成功')
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const columns = [
    { title: '班级名称', dataIndex: 'name', key: 'name' },
    { title: '年级', dataIndex: 'grade', key: 'grade' },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true) }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}><Button size="small" danger>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ]

  const gradeOptions = Array.from(
    new Set(data.map((item) => item.grade).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
  const normalizedKeyword = keyword.trim().toLowerCase()
  const filteredRows = data.filter((item) => {
    const matchesGrade = !gradeFilter || item.grade === gradeFilter
    const name = item.name ? item.name.toLowerCase() : ''
    const matchesKeyword = !normalizedKeyword || name.includes(normalizedKeyword)
    return matchesGrade && matchesKeyword
  })

  const metrics = [
    {
      key: 'total',
      icon: <TeamOutlined />,
      label: '班级总数',
      value: data.length,
      helper: data.length ? '已同步到当前学年' : '暂无班级数据',
      accent: { background: '#e9f2ff', color: '#1d4ed8' },
    },
    {
      key: 'coverage',
      icon: <ApartmentOutlined />,
      label: '年级覆盖',
      value: gradeOptions.length,
      helper: gradeOptions.length ? `涵盖 ${gradeOptions.join('、')}` : '尚未设置年级',
      accent: { background: '#f0f9ff', color: '#0369a1' },
    },
    {
      key: 'filtered',
      icon: <FilterOutlined />,
      label: '筛选结果',
      value: filteredRows.length,
      helper: gradeFilter || normalizedKeyword ? '已应用筛选条件' : '未启用筛选',
      accent: { background: '#fff7e6', color: '#b45309' },
    },
  ]

  const emptyCopy = data.length === 0
    ? '暂无班级数据，先新建班级。'
    : '没有匹配的班级，请调整筛选条件。'

  return (
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Class Workspace"
        title="班级管理"
        description="集中维护班级基础信息，支持快速新建、编辑与清理。"
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>
            新建班级
          </Button>
        )}
        meta={(
          <Space size={12} wrap>
            <span>已加载 {data.length} 个班级</span>
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
        eyebrow="Class Directory"
        title="班级列表"
        description="按年级与名称筛选班级记录，支持快速编辑和删除。"
      >
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>按年级筛选</span>
              <Select
                style={{ minWidth: 160 }}
                allowClear
                placeholder="选择年级"
                value={gradeFilter || undefined}
                options={gradeOptions.map((grade) => ({ label: grade, value: grade }))}
                onChange={(value) => setGradeFilter(value || '')}
              />
            </div>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>关键词搜索</span>
              <Input
                allowClear
                value={keyword}
                placeholder="输入班级名称关键词"
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
        title={editing ? '编辑班级信息' : '新建班级'}
        open={modalOpen}
        onOk={handleOk}
        okText={editing ? '保存修改' : '创建班级'}
        cancelText="取消"
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="例如：高三(1)班" />
          </Form.Item>
          <Form.Item name="grade" label="所属年级" rules={[{ required: true, message: '请输入所属年级' }]}>
            <Input placeholder="例如：高三" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

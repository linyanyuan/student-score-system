import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getSchools, createSchool, updateSchool, deleteSchool } from '../api/school'

const { Option } = Select

const LEVEL_OPTIONS = [
  { value: 'primary', label: '小学' },
  { value: 'middle', label: '初中' },
  { value: 'high', label: '高中' },
]

const levelLabel = { primary: '小学', middle: '初中', high: '高中' }

export default function SchoolManage() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const fetchSchools = async () => {
    setLoading(true)
    try {
      const res = await getSchools()
      setSchools(res.data)
    } catch {
      message.error('获取学校列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchools() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({ name: record.name, location: record.location, school_level: record.school_level })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await updateSchool(editing.id, values)
        message.success('修改成功')
      } else {
        await createSchool(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchSchools()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteSchool(id)
      message.success('删除成功')
      fetchSchools()
    } catch (err) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '学校名称', dataIndex: 'name' },
    { title: '所在地', dataIndex: 'location', render: (v) => v || '-' },
    { title: '学段', dataIndex: 'school_level', render: (v) => levelLabel[v] || v },
    { title: '创建时间', dataIndex: 'created_at', render: (v) => v?.slice(0, 10) },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该学校？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增学校</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={schools}
        loading={loading}
        pagination={false}
      />
      <Modal
        title={editing ? '编辑学校' : '新增学校'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" />
          </Form.Item>
          <Form.Item name="location" label="所在地">
            <Input placeholder="请输入学校所在地" />
          </Form.Item>
          <Form.Item name="school_level" label="学段" rules={[{ required: true, message: '请选择学段' }]}>
            <Select placeholder="请选择学段">
              {LEVEL_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

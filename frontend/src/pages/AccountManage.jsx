import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, message,
  Popconfirm, Tag, Checkbox, Row, Col, Typography,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { getAccounts, createAccount, updateAccount, deleteAccount, batchDeleteAccounts } from '../api/account'
import { getSchools } from '../api/school'

const { Option } = Select
const { Text } = Typography

const ROLE_OPTIONS = [
  { value: 'school_admin', label: '学校管理员' },
  { value: 'teacher', label: '教师' },
  { value: 'student', label: '学生' },
]

const roleColor = { school_admin: 'blue', teacher: 'green', student: 'orange' }
const roleLabel = { school_admin: '学校管理员', teacher: '教师', student: '学生' }

export default function AccountManage() {
  const [accounts, setAccounts] = useState([])
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [keyword, setKeyword] = useState('')
  const [form] = Form.useForm()

  const fetchSchools = async () => {
    try {
      const res = await getSchools()
      setSchools(res.data)
    } catch {
      message.error('获取学校列表失败')
    }
  }

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAccounts(keyword || undefined)
      setAccounts(res.data)
    } catch {
      message.error('获取账户列表失败')
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    fetchSchools()
    fetchAccounts()
  }, [fetchAccounts])

  const openCreate = () => {
    if (schools.length === 0) {
      message.warning('请先在学校管理中创建学校，再创建账户')
      return
    }
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      school_id: record.school_id,
      password: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        const payload = { role: values.role, school_id: values.school_id }
        if (values.username) payload.username = values.username
        if (values.password) payload.password = values.password
        await updateAccount(editing.id, payload)
        message.success('修改成功')
      } else {
        await createAccount(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      setSelectedIds([])
      fetchAccounts()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id)
      message.success('删除成功')
      setSelectedIds(ids => ids.filter(i => i !== id))
      fetchAccounts()
    } catch (err) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      await batchDeleteAccounts(selectedIds)
      message.success(`已删除 ${selectedIds.length} 个账户`)
      setSelectedIds([])
      fetchAccounts()
    } catch (err) {
      message.error(err?.response?.data?.detail || '批量删除失败')
    }
  }

  const schoolMap = Object.fromEntries(schools.map(s => [s.id, s.name]))

  const columns = [
    {
      title: <Checkbox
        checked={selectedIds.length === accounts.length && accounts.length > 0}
        indeterminate={selectedIds.length > 0 && selectedIds.length < accounts.length}
        onChange={(e) => setSelectedIds(e.target.checked ? accounts.map(a => a.id) : [])}
      />,
      width: 48,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.id)}
          onChange={(e) => {
            setSelectedIds(ids =>
              e.target.checked ? [...ids, record.id] : ids.filter(i => i !== record.id)
            )
          }}
        />
      ),
    },
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '所在学校', dataIndex: 'school_id', render: (v) => schoolMap[v] || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (v) => <Tag color={roleColor[v]}>{roleLabel[v] || v}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', render: (v) => v?.slice(0, 10) },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该账户？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增账户</Button>
        </Col>
        <Col>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={selectedIds.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除{selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
          </Button>
        </Col>
        <Col flex="auto">
          <Input.Search
            placeholder="搜索用户名"
            allowClear
            onSearch={(v) => setKeyword(v)}
            style={{ maxWidth: 280 }}
            enterButton={<SearchOutlined />}
          />
        </Col>
      </Row>

      {schools.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text type="warning">当前没有学校数据，请先在【学校管理】中创建学校，再创建账户。</Text>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal
        title={editing ? '编辑账户' : '新增账户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: !editing, message: '请输入用户名' }]}
          >
            <Input placeholder={editing ? '不填则不修改用户名' : '请输入用户名'} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !editing, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}
          >
            <Input.Password placeholder={editing ? '不填则不修改密码' : '请输入密码（至少6位）'} />
          </Form.Item>
          <Form.Item name="role" label="账户类型" rules={[{ required: true, message: '请选择账户类型' }]}>
            <Select placeholder="请选择账户类型">
              {ROLE_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="school_id" label="所在学校" rules={[{ required: true, message: '请选择所在学校' }]}>
            <Select placeholder="请选择学校" showSearch optionFilterProp="children">
              {schools.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

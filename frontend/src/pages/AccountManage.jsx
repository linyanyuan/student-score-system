import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Tag,
  Checkbox,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  FilterOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import {
  batchDeleteAccounts,
  createAccount,
  deleteAccount,
  getAccounts,
  updateAccount,
} from '../api/account'
import { getSchools } from '../api/school'
import { getStudents } from '../api/student'
import { useAuth } from '../contexts/AuthContext'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'

const { Text } = Typography

const ROLE_OPTIONS = [
  { value: 'school_admin', label: '学校管理员' },
  { value: 'teacher', label: '教师' },
  { value: 'student', label: '学生' },
]

const roleColor = { school_admin: 'blue', teacher: 'green', student: 'orange' }
const roleLabel = { school_admin: '学校管理员', teacher: '教师', student: '学生' }

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
}

const toolbarStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const toolbarGroupStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const buildAccountPayload = (values, { canSelectSchool, defaultSchoolId }) => {
  const payload = {
    role: values.role,
    school_id: canSelectSchool ? values.school_id : defaultSchoolId,
    student_id: values.role === 'student' ? values.student_id ?? null : null,
  }

  const username = values.username?.trim()
  if (username) payload.username = username
  if (values.password) payload.password = values.password
  return payload
}

const getAccountErrorMessage = (err) => {
  const raw = err?.message || err?.response?.data?.detail || '操作失败'
  const text = String(raw)
  if (text.includes('username already exists') || text.includes('用户名已存在')) {
    return '用户名已存在，请更换后重试'
  }
  return text
}

export default function AccountManage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [schools, setSchools] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [form] = Form.useForm()
  const selectedRole = Form.useWatch('role', form)

  const isSchoolAdmin = user?.role === 'school_admin'
  const canSelectSchool = user?.role === 'admin'
  const defaultSchoolId = isSchoolAdmin ? user?.school_id ?? null : null
  const creationRoleOptions = useMemo(
    () => (isSchoolAdmin ? ROLE_OPTIONS.filter((item) => item.value === 'teacher' || item.value === 'student') : ROLE_OPTIONS),
    [isSchoolAdmin]
  )

  const fetchSchools = useCallback(async () => {
    if (!canSelectSchool) {
      setSchools([])
      return
    }

    try {
      const res = await getSchools()
      setSchools(res.data)
    } catch {
      message.error('加载学校失败')
    }
  }, [canSelectSchool])

  const fetchStudents = useCallback(async () => {
    try {
      const res = await getStudents({ page: 1, page_size: 1000 })
      setStudents(res.data.items ?? [])
    } catch {
      message.error('加载学生失败')
    }
  }, [])

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAccounts(keyword || undefined)
      setAccounts(res.data)
    } catch {
      message.error('加载账户失败')
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    fetchSchools()
    fetchStudents()
    fetchAccounts()
  }, [fetchSchools, fetchStudents, fetchAccounts])

  const schoolMap = useMemo(
    () => Object.fromEntries(schools.map((school) => [school.id, school.name])),
    [schools]
  )

  const filteredAccounts = useMemo(() => {
    if (!roleFilter) return accounts
    return accounts.filter((account) => account.role === roleFilter)
  }, [accounts, roleFilter])

  const visibleIds = useMemo(() => filteredAccounts.map((account) => account.id), [filteredAccounts])
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const visibleCheckedCount = visibleIds.filter((id) => selectedIds.includes(id)).length

  useEffect(() => {
    const visibleSet = new Set(visibleIds)
    setSelectedIds((ids) => ids.filter((id) => visibleSet.has(id)))
  }, [visibleIds])

  const openCreate = () => {
    if (canSelectSchool && schools.length === 0) {
      message.warning('请先创建学校，再创建账户')
      return
    }
    if (!canSelectSchool && !defaultSchoolId) {
      message.error('当前账号未绑定学校，无法创建账户')
      return
    }

    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      role: creationRoleOptions[0]?.value,
      school_id: canSelectSchool ? undefined : defaultSchoolId,
      student_id: null,
    })
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      school_id: canSelectSchool ? record.school_id : defaultSchoolId,
      student_id: record.student_id ?? null,
      password: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = buildAccountPayload(values, { canSelectSchool, defaultSchoolId })

      if (!payload.school_id) {
        message.error('未识别可用学校，无法保存账户')
        return
      }

      if (editing) {
        await updateAccount(editing.id, payload)
        message.success('账户更新成功')
      } else {
        await createAccount(payload)
        message.success('账户创建成功')
      }

      setModalOpen(false)
      setSelectedIds([])
      fetchAccounts()
    } catch (err) {
      message.error(getAccountErrorMessage(err))
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id)
      message.success('账户删除成功')
      setSelectedIds((ids) => ids.filter((item) => item !== id))
      fetchAccounts()
    } catch (err) {
      message.error(getAccountErrorMessage(err))
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
      message.error(getAccountErrorMessage(err))
    }
  }

  const studentOptions = students.map((student) => ({
    label: `${student.student_no} - ${student.name}`,
    value: student.id,
  }))

  const columns = [
    {
      title: (
        <Checkbox
          checked={allVisibleChecked}
          indeterminate={visibleCheckedCount > 0 && !allVisibleChecked}
          onChange={(event) => {
            if (event.target.checked) {
              setSelectedIds(visibleIds)
            } else {
              setSelectedIds([])
            }
          }}
        />
      ),
      width: 48,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.id)}
          onChange={(event) => {
            setSelectedIds((ids) => (event.target.checked ? [...ids, record.id] : ids.filter((id) => id !== record.id)))
          }}
        />
      ),
    },
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    ...(canSelectSchool
      ? [{ title: '学校', dataIndex: 'school_id', render: (value) => schoolMap[value] || value || '-' }]
      : []),
    {
      title: '角色',
      dataIndex: 'role',
      render: (value) => <Tag color={roleColor[value]}>{roleLabel[value] || value}</Tag>,
    },
    {
      title: '绑定学生',
      render: (_, record) => (record.student_id ? `${record.student_name} (${record.student_no})` : '-'),
    },
    { title: '创建时间', dataIndex: 'created_at', render: (value) => value?.slice(0, 10) || '-' },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该账户？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const teacherCount = accounts.filter((item) => item.role === 'teacher').length
  const studentCount = accounts.filter((item) => item.role === 'student').length
  const boundStudentCount = accounts.filter((item) => item.role === 'student' && item.student_id != null).length

  return (
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Account Workspace"
        title="账户管理"
        description="集中维护教师与学生账号，支持搜索、筛选、批量清理和学生档案绑定。"
        actions={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增账户
            </Button>
            <Button danger icon={<DeleteOutlined />} disabled={selectedIds.length === 0} onClick={handleBatchDelete}>
              删除所选{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          </Space>
        }
        meta={
          <Space wrap>
            <span>当前可见 {filteredAccounts.length} 条账户</span>
            {isSchoolAdmin ? <Tag color="blue">默认绑定当前学校</Tag> : <Tag>支持跨学校分配</Tag>}
          </Space>
        }
      >
        <div style={metricGridStyle}>
          <WorkspaceMetricCard
            icon={<UserOutlined />}
            label="账户总数"
            value={accounts.length}
            helper="已同步当前权限范围内账户"
            accent={{ background: '#e9f2ff', color: '#145fc6' }}
          />
          <WorkspaceMetricCard
            icon={<TeamOutlined />}
            label="教师账户"
            value={teacherCount}
            helper="用于教学与课务管理"
            accent={{ background: '#eff8ef', color: '#18794e' }}
          />
          <WorkspaceMetricCard
            icon={<SafetyCertificateOutlined />}
            label="学生账户"
            value={studentCount}
            helper={`已绑定 ${boundStudentCount} 个学籍档案`}
            accent={{ background: '#fff7e6', color: '#b76c07' }}
          />
          <WorkspaceMetricCard
            icon={<FilterOutlined />}
            label="筛选结果"
            value={filteredAccounts.length}
            helper={roleFilter ? `按角色筛选：${roleLabel[roleFilter] || roleFilter}` : '未启用角色筛选'}
            accent={{ background: '#eef6ff', color: '#2563eb' }}
          />
        </div>
      </WorkspacePageHeader>

      <WorkspaceSectionCard
        eyebrow="Account Directory"
        title="账户列表"
        description="支持按用户名检索和角色筛选，操作后自动刷新数据。"
      >
        <div style={toolbarStyle}>
          <div style={toolbarGroupStyle}>
            <Input.Search
              allowClear
              placeholder="输入用户名关键字"
              onSearch={setKeyword}
              enterButton={<SearchOutlined />}
              style={{ width: 280 }}
            />
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="按角色筛选"
              value={roleFilter || undefined}
              options={creationRoleOptions.map((item) => ({ label: item.label, value: item.value }))}
              onChange={(value) => setRoleFilter(value || '')}
            />
          </div>
          {!canSelectSchool && (
            <Text type="secondary">当前学校ID：{defaultSchoolId || '-'}</Text>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredAccounts}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </WorkspaceSectionCard>

      <Modal
        title={editing ? '编辑账户' : '新增账户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? '保存更新' : '创建账户'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: !editing, message: '请输入用户名' }]}
          >
            <Input placeholder={editing ? '留空则保持当前用户名' : '请输入用户名'} />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: !editing, message: '请输入密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder={editing ? '留空则保持当前密码' : '请输入密码'} />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              placeholder="请选择角色"
              options={creationRoleOptions}
              onChange={(role) => {
                if (role !== 'student') {
                  form.setFieldValue('student_id', null)
                }
              }}
            />
          </Form.Item>

          {canSelectSchool && (
            <Form.Item name="school_id" label="学校" rules={[{ required: true, message: '请选择学校' }]}>
              <Select
                placeholder="请选择学校"
                showSearch
                optionFilterProp="label"
                options={schools.map((school) => ({ label: school.name, value: school.id }))}
              />
            </Form.Item>
          )}

          {!canSelectSchool && (
            <Form.Item label="学校">
              <Input value={defaultSchoolId ?? ''} disabled />
            </Form.Item>
          )}

          {selectedRole === 'student' && (
            <Form.Item
              name="student_id"
              label="绑定学生"
              rules={[{ required: true, message: '请选择学生档案' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择学生档案"
                options={studentOptions}
                allowClear
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}


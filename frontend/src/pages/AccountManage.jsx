import { useState, useEffect, useCallback } from 'react';
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
  Row,
  Col,
  Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  batchDeleteAccounts,
} from '../api/account';
import { getSchools } from '../api/school';
import { getStudents } from '../api/student';

const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'school_admin', label: '校管理员' },
  { value: 'teacher', label: '教师' },
  { value: 'student', label: '学生' },
];

const roleColor = { school_admin: 'blue', teacher: 'green', student: 'orange' };
const roleLabel = { school_admin: '校管理员', teacher: '教师', student: '学生' };

const buildAccountPayload = (values) => ({
  role: values.role,
  school_id: values.school_id,
  student_id: values.role === 'student' ? values.student_id ?? null : null,
});

const getAccountErrorMessage = (err) => {
  const raw = err?.message || err?.response?.data?.detail || '操作失败';
  const text = String(raw);
  if (text.includes('username already exists') || text.includes('用户名已存在')) {
    return '用户名已存在，请更换后重试';
  }
  return text;
};

export default function AccountManage() {
  const [accounts, setAccounts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch('role', form);

  const fetchSchools = async () => {
    try {
      const res = await getSchools();
      setSchools(res.data);
    } catch {
      message.error('加载学校失败');
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await getStudents({ page: 1, page_size: 1000 });
      setStudents(res.data.items ?? []);
    } catch {
      message.error('加载学生失败');
    }
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccounts(keyword || undefined);
      setAccounts(res.data);
    } catch {
      message.error('加载账户失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    fetchSchools();
    fetchStudents();
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreate = () => {
    if (schools.length === 0) {
      message.warning('请先创建学校，再创建账户');
      return;
    }
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      school_id: record.school_id,
      student_id: record.student_id ?? null,
      password: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = buildAccountPayload(values);
      if (values.username) payload.username = values.username;
      if (values.password) payload.password = values.password;

      if (editing) {
        await updateAccount(editing.id, payload);
        message.success('账户更新成功');
      } else {
        await createAccount({ ...values, student_id: payload.student_id });
        message.success('账户创建成功');
      }
      setModalOpen(false);
      setSelectedIds([]);
      fetchAccounts();
    } catch (err) {
      message.error(getAccountErrorMessage(err));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id);
      message.success('账户删除成功');
      setSelectedIds((ids) => ids.filter((item) => item !== id));
      fetchAccounts();
    } catch (err) {
      message.error(getAccountErrorMessage(err));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchDeleteAccounts(selectedIds);
      message.success(`已删除 ${selectedIds.length} 个账户`);
      setSelectedIds([]);
      fetchAccounts();
    } catch (err) {
      message.error(getAccountErrorMessage(err));
    }
  };

  const schoolMap = Object.fromEntries(schools.map((school) => [school.id, school.name]));
  const studentOptions = students.map((student) => ({
    label: `${student.student_no} - ${student.name}`,
    value: student.id,
  }));

  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedIds.length === accounts.length && accounts.length > 0}
          indeterminate={selectedIds.length > 0 && selectedIds.length < accounts.length}
          onChange={(event) => setSelectedIds(event.target.checked ? accounts.map((account) => account.id) : [])}
        />
      ),
      width: 48,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.id)}
          onChange={(event) => {
            setSelectedIds((ids) => (
              event.target.checked ? [...ids, record.id] : ids.filter((id) => id !== record.id)
            ));
          }}
        />
      ),
    },
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '学校', dataIndex: 'school_id', render: (value) => schoolMap[value] || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (value) => <Tag color={roleColor[value]}>{roleLabel[value] || value}</Tag>,
    },
    {
      title: '绑定学生',
      render: (_, record) => (
        record.student_id ? `${record.student_name} (${record.student_no})` : '-'
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', render: (value) => value?.slice(0, 10) },
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
  ];

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
            删除所选{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
        </Col>
        <Col flex="auto">
          <Input.Search
            placeholder="搜索用户名"
            allowClear
            onSearch={setKeyword}
            style={{ maxWidth: 280 }}
            enterButton={<SearchOutlined />}
          />
        </Col>
      </Row>

      {schools.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text type="warning">当前没有学校，请先创建学校后再创建账户。</Text>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
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
              options={ROLE_OPTIONS}
              onChange={(role) => {
                if (role !== 'student') {
                  form.setFieldValue('student_id', null);
                }
              }}
            />
          </Form.Item>
          <Form.Item name="school_id" label="学校" rules={[{ required: true, message: '请选择学校' }]}>
            <Select placeholder="请选择学校" showSearch optionFilterProp="label" options={schools.map((school) => ({ label: school.name, value: school.id }))} />
          </Form.Item>
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
    </>
  );
}

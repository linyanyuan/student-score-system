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
  { value: 'school_admin', label: 'School Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
];

const roleColor = { school_admin: 'blue', teacher: 'green', student: 'orange' };
const roleLabel = { school_admin: 'School Admin', teacher: 'Teacher', student: 'Student' };

const buildAccountPayload = (values) => ({
  role: values.role,
  school_id: values.school_id,
  student_id: values.role === 'student' ? values.student_id ?? null : null,
});

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
      message.error('Failed to load schools');
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await getStudents({ page: 1, page_size: 1000 });
      setStudents(res.data.items ?? []);
    } catch {
      message.error('Failed to load students');
    }
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccounts(keyword || undefined);
      setAccounts(res.data);
    } catch {
      message.error('Failed to load accounts');
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
      message.warning('Create a school before creating accounts');
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
        message.success('Account updated');
      } else {
        await createAccount({ ...values, student_id: payload.student_id });
        message.success('Account created');
      }
      setModalOpen(false);
      setSelectedIds([]);
      fetchAccounts();
    } catch (err) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail);
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id);
      message.success('Account deleted');
      setSelectedIds((ids) => ids.filter((item) => item !== id));
      fetchAccounts();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'Delete failed');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchDeleteAccounts(selectedIds);
      message.success(`Deleted ${selectedIds.length} accounts`);
      setSelectedIds([]);
      fetchAccounts();
    } catch (err) {
      message.error(err?.response?.data?.detail || 'Batch delete failed');
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
    { title: 'Username', dataIndex: 'username' },
    { title: 'School', dataIndex: 'school_id', render: (value) => schoolMap[value] || '-' },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (value) => <Tag color={roleColor[value]}>{roleLabel[value] || value}</Tag>,
    },
    {
      title: 'Bound Student',
      render: (_, record) => (
        record.student_id ? `${record.student_name} (${record.student_no})` : '-'
      ),
    },
    { title: 'Created At', dataIndex: 'created_at', render: (value) => value?.slice(0, 10) },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
          <Popconfirm title="Delete this account?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create Account</Button>
        </Col>
        <Col>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={selectedIds.length === 0}
            onClick={handleBatchDelete}
          >
            Delete Selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
        </Col>
        <Col flex="auto">
          <Input.Search
            placeholder="Search username"
            allowClear
            onSearch={setKeyword}
            style={{ maxWidth: 280 }}
            enterButton={<SearchOutlined />}
          />
        </Col>
      </Row>

      {schools.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text type="warning">No schools found. Create a school before creating accounts.</Text>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (total) => `Total ${total}` }}
      />

      <Modal
        title={editing ? 'Edit Account' : 'Create Account'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: !editing, message: 'Please enter a username' }]}
          >
            <Input placeholder={editing ? 'Leave blank to keep the current username' : 'Enter username'} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: !editing, message: 'Please enter a password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder={editing ? 'Leave blank to keep the current password' : 'Enter password'} />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select
              placeholder="Select role"
              options={ROLE_OPTIONS}
              onChange={(role) => {
                if (role !== 'student') {
                  form.setFieldValue('student_id', null);
                }
              }}
            />
          </Form.Item>
          <Form.Item name="school_id" label="School" rules={[{ required: true, message: 'Please select a school' }]}>
            <Select placeholder="Select school" showSearch optionFilterProp="label" options={schools.map((school) => ({ label: school.name, value: school.id }))} />
          </Form.Item>
          {selectedRole === 'student' && (
            <Form.Item
              name="student_id"
              label="Bind Student"
              rules={[{ required: true, message: 'Please select a student profile' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select student profile"
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

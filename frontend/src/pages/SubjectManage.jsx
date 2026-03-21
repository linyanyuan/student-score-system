import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../api/subject'

const GRADE_OPTIONS = ['七年级', '八年级', '九年级', '高一', '高二', '高三']

export default function SubjectManage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
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
      // grades 是数组，转为逗号分隔字符串
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

  const columns = [
    { title: '科目名称', dataIndex: 'name', key: 'name' },
    { title: '科目代码', dataIndex: 'code', key: 'code' },
    {
      title: '适用年级', dataIndex: 'grades', key: 'grades',
      render: (v) => v ? v.split(',').map(g => <Tag key={g}>{g}</Tag>) : '-',
    },
    {
      title: '操作', key: 'action', width: 150,
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
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>新增科目</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
      <Modal title={editing ? '编辑科目' : '新增科目'} open={modalOpen} onOk={handleOk} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="科目名称" rules={[{ required: true, message: '请输入科目名称' }]}>
            <Input placeholder="如：数学" />
          </Form.Item>
          <Form.Item name="code" label="科目代码" rules={[{ required: true, message: '请输入科目代码' }]}>
            <Input placeholder="如：MATH" />
          </Form.Item>
          <Form.Item name="grades" label="适用年级">
            <Select mode="multiple" placeholder="选择适用年级（可多选）" allowClear>
              {GRADE_OPTIONS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

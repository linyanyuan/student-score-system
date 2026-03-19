import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, Space, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getExams, createExam, updateExam, deleteExam } from '../api/exam'

export default function ExamManage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
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
      if (err.message) message.error(err.message)
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

  const columns = [
    { title: '考试名称', dataIndex: 'name', key: 'name' },
    { title: '考试日期', dataIndex: 'exam_date', key: 'exam_date', width: 120 },
    { title: '参与年级', dataIndex: 'grade', key: 'grade', width: 100 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => {
            setEditing(record)
            form.setFieldsValue({ ...record, exam_date: dayjs(record.exam_date) })
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
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>新增考试</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
      <Modal title={editing ? '编辑考试' : '新增考试'} open={modalOpen} onOk={handleOk} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="如：2024年期中考试" />
          </Form.Item>
          <Form.Item name="exam_date" label="考试日期" rules={[{ required: true, message: '请选择考试日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="grade" label="参与年级" rules={[{ required: true, message: '请输入参与年级' }]}>
            <Input placeholder="如：高三" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { getCustomFields, createCustomField, updateCustomField, deleteCustomField } from '../api/customField'

const fieldTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '下拉选项', value: 'select' },
]

export default function CustomFieldManage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const fieldType = Form.useWatch('field_type', form)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getCustomFields()
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
        field_name: values.field_name,
        field_type: values.field_type,
        sort_order: values.sort_order || 0,
        options: values.field_type === 'select' && values.optionsList?.length
          ? JSON.stringify(values.optionsList)
          : null,
      }
      if (editing) {
        await updateCustomField(editing.id, payload)
        message.success('修改成功')
      } else {
        await createCustomField(payload)
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

  const handleEdit = (record) => {
    setEditing(record)
    let optionsList = []
    if (record.options) {
      try { optionsList = JSON.parse(record.options) } catch { /* empty */ }
    }
    form.setFieldsValue({
      field_name: record.field_name,
      field_type: record.field_type,
      sort_order: record.sort_order,
      optionsList,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      await deleteCustomField(id)
      message.success('删除成功')
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const typeLabels = { text: '文本', number: '数字', date: '日期', select: '下拉选项' }

  const columns = [
    { title: '字段名称', dataIndex: 'field_name', key: 'field_name' },
    { title: '字段类型', dataIndex: 'field_type', key: 'field_type', render: (v) => typeLabels[v] || v },
    {
      title: '选项', dataIndex: 'options', key: 'options', render: (v) => {
        if (!v) return '-'
        try {
          return JSON.parse(v).map((opt) => <Tag key={opt}>{opt}</Tag>)
        } catch {
          return v
        }
      },
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}><Button size="small" danger>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>新增字段</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
      <Modal title={editing ? '编辑字段' : '新增字段'} open={modalOpen} onOk={handleOk} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="field_name" label="字段名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input placeholder="如：民族" />
          </Form.Item>
          <Form.Item name="field_type" label="字段类型" rules={[{ required: true, message: '请选择字段类型' }]}>
            <Select options={fieldTypeOptions} placeholder="选择类型" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {fieldType === 'select' && (
            <Form.List name="optionsList">
              {(fields, { add, remove }) => (
                <>
                  <label style={{ display: 'block', marginBottom: 8 }}>下拉选项</label>
                  {fields.map((field) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...field} noStyle rules={[{ required: true, message: '请输入选项' }]}>
                        <Input placeholder="选项值" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加选项</Button>
                </>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>
    </>
  )
}

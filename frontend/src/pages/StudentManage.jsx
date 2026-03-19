import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Select, Space, message, Popconfirm,
  Drawer, Form, DatePicker, Upload, Modal, InputNumber, Tag,
} from 'antd'
import { PlusOutlined, UploadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  importStudents, exportStudents, downloadTemplate, deleteStudents,
} from '../api/student'
import { getClasses } from '../api/class'
import { getCustomFields } from '../api/customField'

export default function StudentManage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({})
  const [classes, setClasses] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importSelectModalOpen, setImportSelectModalOpen] = useState(false)
  const [importClassId, setImportClassId] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize, ...filters }
      const res = await getStudents(params)
      setData(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data)).catch(() => {})
    getCustomFields().then((res) => setCustomFields(res.data)).catch(() => {})
  }, [])

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]))

  const handleSearch = () => {
    const values = filterForm.getFieldsValue()
    const f = {}
    if (values.student_no) f.student_no = values.student_no
    if (values.name) f.name = values.name
    if (values.class_id) f.class_id = values.class_id
    setFilters(f)
    setPage(1)
  }

  const handleReset = () => {
    filterForm.resetFields()
    setFilters({})
    setPage(1)
  }

  const openDrawer = (record = null) => {
    setEditing(record)
    if (record) {
      const cfData = record.custom_fields ? JSON.parse(record.custom_fields) : {}
      form.setFieldsValue({
        ...record,
        birth_date: record.birth_date ? dayjs(record.birth_date) : null,
        ...Object.fromEntries(customFields.map((cf) => [`cf_${cf.id}`, cfData[cf.field_name] || null])),
      })
    } else {
      form.resetFields()
    }
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const cfData = {}
      customFields.forEach((cf) => {
        const val = values[`cf_${cf.id}`]
        if (val !== undefined && val !== null && val !== '') {
          cfData[cf.field_name] = val
        }
        delete values[`cf_${cf.id}`]
      })
      const payload = {
        ...values,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        custom_fields: Object.keys(cfData).length ? JSON.stringify(cfData) : null,
      }
      if (editing) {
        await updateStudent(editing.id, payload)
        message.success('修改成功')
      } else {
        await createStudent(payload)
        message.success('创建成功')
      }
      setDrawerOpen(false)
      form.resetFields()
      setEditing(null)
      fetchData()
    } catch (err) {
      if (err.message) message.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteStudent(id)
      message.success('删除成功')
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleBatchDelete = async () => {
    try {
      const res = await deleteStudents(selectedRowKeys)
      message.success(`已删除 ${res.data.deleted_count} 条记录`)
      setSelectedRowKeys([])
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleOpenImportModal = (file) => {
    setImportFile(file)
    setImportClassId(null)
    setImportSelectModalOpen(true)
    return false
  }

  const handleConfirmImport = async () => {
    if (!importClassId) {
      message.warning('请选择班级')
      return
    }
    if (!importFile) {
      message.warning('请选择文件')
      return
    }
    try {
      const res = await importStudents(importFile, importClassId)
      setImportSelectModalOpen(false)
      setImportResult(res.data)
      setImportModalOpen(true)
      setImportFile(null)
      setImportClassId(null)
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleExport = async () => {
    try {
      const res = await exportStudents(filters)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'students.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'student_template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.message)
    }
  }

  const renderCustomFieldInput = (cf) => {
    if (cf.field_type === 'number') return <InputNumber style={{ width: '100%' }} />
    if (cf.field_type === 'date') return <DatePicker style={{ width: '100%' }} />
    if (cf.field_type === 'select') {
      let opts = []
      try { opts = JSON.parse(cf.options || '[]') } catch { /* empty */ }
      return <Select options={opts.map((o) => ({ label: o, value: o }))} placeholder="请选择" allowClear />
    }
    return <Input />
  }

  const columns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 120 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '性别', dataIndex: 'gender', key: 'gender', width: 60, render: (v) => (v === 'M' ? '男' : '女') },
    { title: '出生日期', dataIndex: 'birth_date', key: 'birth_date', width: 120 },
    { title: '班级', key: 'class_name', width: 120, render: (_, r) => classMap[r.class_id] || '-' },
    { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 130 },
    ...customFields.map((cf) => ({
      title: cf.field_name, key: `cf_${cf.id}`, width: 100,
      render: (_, r) => {
        if (!r.custom_fields) return '-'
        try {
          const cfData = JSON.parse(r.custom_fields)
          return cfData[cf.field_name] || '-'
        } catch { return '-' }
      },
    })),
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openDrawer(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Form form={filterForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="student_no"><Input placeholder="学号" allowClear /></Form.Item>
        <Form.Item name="name"><Input placeholder="姓名" allowClear /></Form.Item>
        <Form.Item name="class_id">
          <Select style={{ width: 150 }} placeholder="班级" allowClear options={classes.map((c) => ({ label: c.name, value: c.id }))} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>新增学生</Button>
        <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleOpenImportModal}>
          <Button icon={<UploadOutlined />}>批量导入</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
        <Button onClick={handleDownloadTemplate}>下载模板</Button>
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={`确认删除选中的 ${selectedRowKeys.length} 条记录？`}
            onConfirm={handleBatchDelete}
          >
            <Button danger>删除所选 ({selectedRowKeys.length})</Button>
          </Popconfirm>
        )}
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
      />

      <Drawer
        title={editing ? '编辑学生' : '新增学生'}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); form.resetFields() }}
        width={480}
        extra={<Button type="primary" onClick={handleSave}>保存</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="student_no" label="学号" rules={[{ required: true, message: '请输入学号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
            <Select options={[{ label: '男', value: 'M' }, { label: '女', value: 'F' }]} />
          </Form.Item>
          <Form.Item name="birth_date" label="出生日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="class_id" label="班级" rules={[{ required: true, message: '请选择班级' }]}>
            <Select options={classes.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="phone" label="联系方式">
            <Input />
          </Form.Item>
          {customFields.map((cf) => (
            <Form.Item key={cf.id} name={`cf_${cf.id}`} label={cf.field_name}>
              {renderCustomFieldInput(cf)}
            </Form.Item>
          ))}
        </Form>
      </Drawer>

      <Modal
        title="导入结果"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={<Button onClick={() => setImportModalOpen(false)}>关闭</Button>}
      >
        {importResult && (
          <>
            <p>成功导入: <Tag color="green">{importResult.success_count}</Tag> 条</p>
            <p>失败: <Tag color="red">{importResult.error_count}</Tag> 条</p>
            {importResult.errors?.length > 0 && (
              <Table
                size="small"
                dataSource={importResult.errors}
                rowKey="row"
                columns={[
                  { title: '行号', dataIndex: 'row', width: 60 },
                  { title: '错误', dataIndex: 'error' },
                ]}
                pagination={false}
              />
            )}
          </>
        )}
      </Modal>

      <Modal
        title="批量导入学生"
        open={importSelectModalOpen}
        onCancel={() => { setImportSelectModalOpen(false); setImportFile(null); setImportClassId(null) }}
        onOk={handleConfirmImport}
        okText="确认导入"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="选择班级" required>
            <Select
              placeholder="请选择导入到哪个班级"
              value={importClassId}
              onChange={setImportClassId}
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="已选择文件">
            <span>{importFile?.name || '无'}</span>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

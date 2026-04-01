import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Drawer,
  Form,
  DatePicker,
  Upload,
  Modal,
  InputNumber,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined,
  FormOutlined,
  SolutionOutlined,
  ApartmentOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents,
  exportStudents,
  downloadTemplate,
  deleteStudents,
} from '../api/student'
import { getClasses } from '../api/class'
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from '../api/customField'
import WorkspacePageHeader from '../components/workspace/WorkspacePageHeader'
import WorkspaceMetricCard from '../components/workspace/WorkspaceMetricCard'
import WorkspaceSectionCard from '../components/workspace/WorkspaceSectionCard'

const fieldTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '下拉选项', value: 'select' },
]

const fieldTypeLabels = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '下拉选项',
}

const GRADE_RANK = {
  一年级: 1,
  二年级: 2,
  三年级: 3,
  四年级: 4,
  五年级: 5,
  六年级: 6,
  七年级: 7,
  八年级: 8,
  九年级: 9,
  高一: 10,
  高二: 11,
  高三: 12,
}

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

function parseFieldOptions(options) {
  if (!options) return []
  try {
    const parsed = JSON.parse(options)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseCustomFieldData(rawValue) {
  if (!rawValue) return {}
  try {
    return JSON.parse(rawValue)
  } catch {
    return {}
  }
}

function mapStudentCustomFieldValues(record, customFields) {
  const cfData = parseCustomFieldData(record.custom_fields)

  return Object.fromEntries(customFields.map((field) => {
    const rawValue = cfData[field.field_name]
    if (!rawValue) {
      return [`cf_${field.id}`, null]
    }
    if (field.field_type === 'date') {
      const parsedDate = dayjs(rawValue)
      return [`cf_${field.id}`, parsedDate.isValid() ? parsedDate : null]
    }
    return [`cf_${field.id}`, rawValue]
  }))
}

function normalizeFieldValue(field, value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (field.field_type === 'date' && dayjs.isDayjs(value)) {
    return value.format('YYYY-MM-DD')
  }
  return value
}

function compareGrade(left, right) {
  return (GRADE_RANK[left] ?? 999) - (GRADE_RANK[right] ?? 999) || String(left || '').localeCompare(String(right || ''), 'zh-Hans-CN')
}

export default function StudentManage() {
  const [data, setData] = useState([])
  const [metricStudents, setMetricStudents] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({})
  const [classes, setClasses] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false)
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false)
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importSelectModalOpen, setImportSelectModalOpen] = useState(false)
  const [importClassId, setImportClassId] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const [fieldForm] = Form.useForm()
  const fieldType = Form.useWatch('field_type', fieldForm)

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

  const fetchMetricStudents = useCallback(async () => {
    try {
      const res = await getStudents({ page: 1, page_size: 9999 })
      setMetricStudents(res.data.items || [])
    } catch (err) {
      message.error(err.message)
    }
  }, [])

  const fetchCustomFieldDefinitions = useCallback(async () => {
    try {
      const res = await getCustomFields()
      setCustomFields(res.data)
    } catch (err) {
      message.error(err.message)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data)).catch(() => {})
    fetchCustomFieldDefinitions()
    fetchMetricStudents()
  }, [fetchCustomFieldDefinitions, fetchMetricStudents])

  const classMap = Object.fromEntries(classes.map((item) => [item.id, item.name]))

  const handleSearch = () => {
    const values = filterForm.getFieldsValue()
    const nextFilters = {}

    if (values.student_no) nextFilters.student_no = values.student_no
    if (values.name) nextFilters.name = values.name
    if (values.class_id) nextFilters.class_id = values.class_id

    setFilters(nextFilters)
    setPage(1)
  }

  const handleReset = () => {
    filterForm.resetFields()
    setFilters({})
    setPage(1)
  }

  const openStudentDrawer = (record = null) => {
    setEditingStudent(record)
    if (record) {
      form.setFieldsValue({
        ...record,
        birth_date: record.birth_date ? dayjs(record.birth_date) : null,
        ...mapStudentCustomFieldValues(record, customFields),
      })
    } else {
      form.resetFields()
    }
    setStudentDrawerOpen(true)
  }

  const closeStudentDrawer = () => {
    setStudentDrawerOpen(false)
    setEditingStudent(null)
    form.resetFields()
  }

  const handleSaveStudent = async () => {
    try {
      const values = await form.validateFields()
      const cfData = {}

      customFields.forEach((field) => {
        const formKey = `cf_${field.id}`
        const normalizedValue = normalizeFieldValue(field, values[formKey])
        if (normalizedValue !== null) {
          cfData[field.field_name] = normalizedValue
        }
        delete values[formKey]
      })

      const payload = {
        ...values,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        custom_fields: Object.keys(cfData).length ? JSON.stringify(cfData) : null,
      }

      if (editingStudent) {
        await updateStudent(editingStudent.id, payload)
        message.success('修改成功')
      } else {
        await createStudent(payload)
        message.success('创建成功')
      }

      closeStudentDrawer()
      fetchData()
      fetchMetricStudents()
    } catch (err) {
      if (err.message) {
        message.error(err.message)
      }
    }
  }

  const handleDeleteStudent = async (id) => {
    try {
      await deleteStudent(id)
      message.success('删除成功')
      fetchData()
      fetchMetricStudents()
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
      fetchMetricStudents()
    } catch (err) {
      message.error(err.message)
    }
  }

  const openFieldModal = (record = null) => {
    setEditingField(record)
    if (record) {
      fieldForm.setFieldsValue({
        field_name: record.field_name,
        field_type: record.field_type,
        sort_order: record.sort_order,
        optionsList: parseFieldOptions(record.options),
      })
    } else {
      fieldForm.resetFields()
      fieldForm.setFieldsValue({ sort_order: 0, optionsList: [] })
    }
    setFieldModalOpen(true)
  }

  const closeFieldModal = () => {
    setFieldModalOpen(false)
    setEditingField(null)
    fieldForm.resetFields()
  }

  const handleSaveField = async () => {
    try {
      const values = await fieldForm.validateFields()
      const optionsList = Array.isArray(values.optionsList)
        ? values.optionsList.map((item) => String(item || '').trim()).filter(Boolean)
        : []
      const payload = {
        field_name: values.field_name,
        field_type: values.field_type,
        sort_order: values.sort_order || 0,
        options: values.field_type === 'select' && optionsList.length
          ? JSON.stringify(optionsList)
          : null,
      }

      if (editingField) {
        await updateCustomField(editingField.id, payload)
        message.success('字段已更新')
      } else {
        await createCustomField(payload)
        message.success('字段已创建')
      }

      closeFieldModal()
      fetchCustomFieldDefinitions()
    } catch (err) {
      if (err.message) {
        message.error(err.message)
      }
    }
  }

  const handleDeleteField = async (id) => {
    try {
      await deleteCustomField(id)
      message.success('字段已删除')
      fetchCustomFieldDefinitions()
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
      fetchMetricStudents()
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

  const renderCustomFieldInput = (field) => {
    if (field.field_type === 'number') {
      return <InputNumber style={{ width: '100%' }} />
    }
    if (field.field_type === 'date') {
      return <DatePicker style={{ width: '100%' }} />
    }
    if (field.field_type === 'select') {
      const options = parseFieldOptions(field.options)
      return (
        <Select
          options={options.map((option) => ({ label: option, value: option }))}
          placeholder="请选择"
          allowClear
        />
      )
    }
    return <Input />
  }

  const studentColumns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 120 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '性别', dataIndex: 'gender', key: 'gender', width: 80, render: (value) => (value === 'M' ? '男' : '女') },
    { title: '出生日期', dataIndex: 'birth_date', key: 'birth_date', width: 120 },
    { title: '班级', key: 'class_name', width: 140, render: (_, record) => classMap[record.class_id] || '-' },
    { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 140 },
    ...customFields.map((field) => ({
      title: field.field_name,
      key: `cf_${field.id}`,
      width: 120,
      render: (_, record) => {
        const cfData = parseCustomFieldData(record.custom_fields)
        return cfData[field.field_name] || '-'
      },
    })),
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openStudentDrawer(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteStudent(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const fieldColumns = [
    { title: '字段名称', dataIndex: 'field_name', key: 'field_name', width: 120 },
    {
      title: '类型',
      dataIndex: 'field_type',
      key: 'field_type',
      width: 100,
      render: (value) => fieldTypeLabels[value] || value,
    },
    {
      title: '选项',
      dataIndex: 'options',
      key: 'options',
      render: (value) => {
        const options = parseFieldOptions(value)
        if (!options.length) return '-'
        return options.map((option) => <Tag key={option}>{option}</Tag>)
      },
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openFieldModal(record)}>编辑</Button>
          <Popconfirm title="确认删除字段？" onConfirm={() => handleDeleteField(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const classGradeMap = Object.fromEntries(classes.map((item) => [item.id, item.grade]))
  const gradeDistribution = Object.entries(
    metricStudents.reduce((accumulator, student) => {
      const grade = classGradeMap[student.class_id]
      if (!grade) return accumulator
      accumulator[grade] = (accumulator[grade] || 0) + 1
      return accumulator
    }, {}),
  )
    .sort(([left], [right]) => compareGrade(left, right))
    .map(([grade, count]) => ({ grade, count }))
  const gradeDistributionSummary = gradeDistribution.map((item) => `${item.grade} ${item.count}`).join(' · ')

  const metrics = [
    {
      key: 'students',
      icon: <SolutionOutlined />,
      label: '学生总数',
      value: total,
      helper: total ? '已同步当前筛选结果对应的学生档案' : '暂无学生数据',
      accent: { background: '#e9f2ff', color: '#1d4ed8' },
    },
    {
      key: 'classes',
      icon: <ApartmentOutlined />,
      label: '班级覆盖',
      value: classes.length,
      helper: classes.length ? '当前账号可访问的班级范围' : '暂无班级数据',
      accent: { background: '#f0f9ff', color: '#0369a1' },
    },
    {
      key: 'fields',
      icon: <FormOutlined />,
      label: '自定义字段',
      value: customFields.length,
      helper: customFields.length ? '字段配置会同步影响学生表单和导入导出' : '暂未配置扩展字段',
      accent: { background: '#ecfdf3', color: '#047857' },
    },
    {
      key: 'gradeDistribution',
      icon: <ApartmentOutlined />,
      label: '年级分布',
      value: `${gradeDistribution.length} 个年级`,
      helper: gradeDistributionSummary || '暂无年级数据',
      accent: { background: '#fff7e6', color: '#b45309' },
    },
  ]

  const emptyCopy = total === 0
    ? '暂无学生数据，先新增学生档案。'
    : '没有匹配的学生，请调整筛选条件。'

  return (
    <div className="workspace-page">
      <WorkspacePageHeader
        eyebrow="Student Workspace"
        title="学生管理"
        description="集中维护学生档案、批量导入导出，并在同一工作区管理学生自定义字段。"
        actions={(
          <Space wrap>
            <Button icon={<FormOutlined />} onClick={() => setFieldDrawerOpen(true)}>
              添加自定义字段
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openStudentDrawer()}>
              新增学生
            </Button>
          </Space>
        )}
        meta={(
          <Space size={12} wrap>
            <span>已加载 {total} 名学生</span>
            <span>字段 {customFields.length} 个</span>
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
        eyebrow="Student Directory"
        title="学生列表"
        description="按学号、姓名、班级筛选学生档案，支持批量导入导出、批量删除和动态扩展字段展示。"
      >
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <div style={filterGroupStyle}>
              <span style={filterLabelStyle}>学号</span>
              <Form form={filterForm} layout="inline">
                <Form.Item name="student_no" style={{ marginBottom: 0 }}>
                  <Input allowClear placeholder="输入学号" />
                </Form.Item>
                <Form.Item name="name" style={{ marginBottom: 0 }}>
                  <Input allowClear placeholder="输入姓名" />
                </Form.Item>
                <Form.Item name="class_id" style={{ marginBottom: 0 }}>
                  <Select
                    style={{ minWidth: 160 }}
                    placeholder="选择班级"
                    allowClear
                    options={classes.map((item) => ({ label: item.name, value: item.id }))}
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                    <Button onClick={handleReset}>重置</Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </div>
          <div style={filterGroupStyle}>
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
          </div>
        </div>

        <Table
          columns={studentColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: emptyCopy }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
        />
      </WorkspaceSectionCard>

      <Drawer
        title="自定义字段"
        open={fieldDrawerOpen}
        onClose={() => setFieldDrawerOpen(false)}
        width={560}
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openFieldModal()}>
            新增字段
          </Button>
        )}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>学生档案字段配置</div>
            <div style={{ color: 'var(--workspace-muted)' }}>
              字段配置会同步影响学生表单、学生列表和 Excel 模板，用于统一管理学生扩展信息。
            </div>
          </div>

          <Table
            columns={fieldColumns}
            dataSource={customFields}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: '暂无自定义字段，点击右上角新增字段开始配置。' }}
          />
        </Space>
      </Drawer>

      <Modal
        title={editingField ? '编辑字段' : '新增字段'}
        open={fieldModalOpen}
        onOk={handleSaveField}
        okText={editingField ? '保存修改' : '创建字段'}
        cancelText="取消"
        onCancel={closeFieldModal}
        width={520}
      >
        <Form form={fieldForm} layout="vertical">
          <Form.Item
            name="field_name"
            label="字段名称"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="如：民族、籍贯、特长" />
          </Form.Item>
          <Form.Item
            name="field_type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select options={fieldTypeOptions} placeholder="选择字段类型" />
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
                      <Form.Item
                        {...field}
                        noStyle
                        rules={[{ required: true, message: '请输入选项内容' }]}
                      >
                        <Input placeholder="选项值" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} block onClick={() => add()}>
                    添加选项
                  </Button>
                </>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>

      <Drawer
        title={editingStudent ? '编辑学生' : '新增学生'}
        open={studentDrawerOpen}
        onClose={closeStudentDrawer}
        width={480}
        extra={<Button type="primary" onClick={handleSaveStudent}>保存</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="student_no"
            label="学号"
            rules={[{ required: true, message: '请输入学号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择性别' }]}
          >
            <Select options={[{ label: '男', value: 'M' }, { label: '女', value: 'F' }]} />
          </Form.Item>
          <Form.Item name="birth_date" label="出生日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="class_id"
            label="班级"
            rules={[{ required: true, message: '请选择班级' }]}
          >
            <Select options={classes.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item name="phone" label="联系方式">
            <Input />
          </Form.Item>
          {customFields.map((field) => (
            <Form.Item key={field.id} name={`cf_${field.id}`} label={field.field_name}>
              {renderCustomFieldInput(field)}
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
        onCancel={() => {
          setImportSelectModalOpen(false)
          setImportFile(null)
          setImportClassId(null)
        }}
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
              options={classes.map((item) => ({ label: item.name, value: item.id }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="已选择文件">
            <span>{importFile?.name || '无'}</span>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

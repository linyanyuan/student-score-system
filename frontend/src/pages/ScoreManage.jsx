import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  BarChartOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'

import {
  batchDeleteScoresByStudents,
  createScore,
  deleteScoreByStudent,
  downloadScoreTemplate,
  exportScores,
  getScoreEntrySubjects,
  getScores,
  importScores,
  upsertScore,
} from '../api/score'
import { getExams } from '../api/exam'
import { getClasses } from '../api/class'
import { getStudents } from '../api/student'
import { useAuth } from '../contexts/AuthContext'
import ClassAnalysis from './ClassAnalysis'
import StudentAnalysis from './StudentAnalysis'

const SUBJECT_DISPLAY_ORDER = ['语文', '数学', '英语', '物理', '生物', '历史', '地理', '道法', '政治', '化学']

const parseExamGrades = (gradeText) =>
  String(gradeText || '')
    .replaceAll('，', ',')
    .replaceAll('、', ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const sortSubjects = (subjects) => {
  const orderMap = Object.fromEntries(SUBJECT_DISPLAY_ORDER.map((name, index) => [name, index]))
  return [...subjects].sort((left, right) => {
    const leftOrder = orderMap[left.name] ?? 999
    const rightOrder = orderMap[right.name] ?? 999
    return leftOrder - rightOrder || String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN')
  })
}

const buildScoreFieldName = (subjectKey) => `score_${subjectKey}`

const normalizeTableSubjects = (visibleSubjects, record) => {
  if (visibleSubjects.length > 0) return visibleSubjects
  return Object.keys(record.subjects || {}).map((name) => ({ id: name, name }))
}

export default function ScoreManage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('list')
  const [analysisStudentId, setAnalysisStudentId] = useState(null)
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [searchStudentNo, setSearchStudentNo] = useState('')
  const [searchStudentName, setSearchStudentName] = useState('')
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedEntryStudent, setSelectedEntryStudent] = useState(null)
  const [entrySubjects, setEntrySubjects] = useState([])
  const [entryLoading, setEntryLoading] = useState(false)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editSubjects, setEditSubjects] = useState([])
  const [editLoading, setEditLoading] = useState(false)

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedImportGrade, setSelectedImportGrade] = useState(null)
  const [importResultOpen, setImportResultOpen] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const canManageScores = ['admin', 'school_admin', 'teacher'].includes(user?.role)
  const canViewClassAnalysis = user?.role !== 'student'
  const selectedExamInfo = exams.find((exam) => exam.id === selectedExam)
  const importGradeOptions = parseExamGrades(selectedExamInfo?.grade)
  const hasMissingClassImportErrors = importResult?.errors?.some((item) =>
    String(item?.error || '').includes('在年级') && String(item?.error || '').includes('中不存在')
  )

  const fetchBaseOptions = async () => {
    try {
      const [examRes, classRes] = await Promise.all([getExams(), getClasses()])
      setExams(examRes.data || [])
      setClasses(classRes.data || [])
    } catch (err) {
      message.error(err.message)
    }
  }

  useEffect(() => {
    fetchBaseOptions()
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedExam) {
      setData([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      const params = { exam_id: selectedExam, page, page_size: pageSize }
      if (selectedClass) params.class_id = selectedClass
      if (searchStudentNo) params.student_no = searchStudentNo
      if (searchStudentName) params.student_name = searchStudentName
      const res = await getScores(params)
      setData(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchStudentName, searchStudentNo, selectedClass, selectedExam])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const visibleSubjects = useMemo(() => {
    const subjectNames = new Set()
    data.forEach((item) => {
      Object.keys(item.subjects || {}).forEach((name) => subjectNames.add(name))
    })
    return sortSubjects(Array.from(subjectNames).map((name) => ({ id: name, name })))
  }, [data])

  const visibleSubjectsForEdit = useMemo(() => editSubjects, [editSubjects])

  const closeAddModal = () => {
    setAddModalOpen(false)
    setSelectedEntryStudent(null)
    setEntrySubjects([])
    addForm.resetFields()
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingRecord(null)
    setEditSubjects([])
    editForm.resetFields()
  }

  const handleAnalyzeStudent = (studentId) => {
    setAnalysisStudentId(studentId)
    setActiveTab('student-analysis')
  }

  const handleSearch = () => {
    setPage(1)
    setSelectedRowKeys([])
    fetchData()
  }

  const loadStudentsForEntry = async () => {
    try {
      const params = { page_size: 1000 }
      if (selectedClass) params.class_id = selectedClass
      const res = await getStudents(params)
      setStudents(res.data.items || [])
    } catch (err) {
      message.error(err.message)
    }
  }

  const openAddModal = async () => {
    if (!selectedExam) {
      message.warning('请先选择考试')
      return
    }
    closeAddModal()
    await loadStudentsForEntry()
    setAddModalOpen(true)
  }

  const handleEntryStudentChange = async (studentId) => {
    setSelectedEntryStudent(studentId)
    addForm.resetFields(
      Object.keys(addForm.getFieldsValue()).filter((key) => String(key).startsWith('score_')),
    )
    addForm.setFieldValue('student_id', studentId)
    if (!studentId) {
      setEntrySubjects([])
      return
    }
    setEntryLoading(true)
    try {
      const res = await getScoreEntrySubjects({ exam_id: selectedExam, student_id: studentId })
      setEntrySubjects(sortSubjects(res.data.subjects || []))
    } catch (err) {
      setEntrySubjects([])
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    } finally {
      setEntryLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields()
      for (const subject of entrySubjects) {
        const score = values[buildScoreFieldName(subject.id)]
        if (score !== undefined && score !== null) {
          await createScore({
            student_id: values.student_id,
            exam_id: selectedExam,
            subject_id: subject.id,
            score,
          })
        }
      }
      message.success('成绩录入成功')
      closeAddModal()
      fetchData()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    }
  }

  const openEditModal = async (record) => {
    if (!selectedExam) {
      message.warning('请先选择考试')
      return
    }

    const currentTableSubjectNames = new Set(
      normalizeTableSubjects(visibleSubjects, record).map((subject) => subject.name),
    )
    Object.keys(record.subjects || {}).forEach((subjectName) => currentTableSubjectNames.add(subjectName))

    setEditLoading(true)
    try {
      const res = await getScoreEntrySubjects({ exam_id: selectedExam, student_id: record.student_id })
      const availableSubjects = sortSubjects(res.data.subjects || [])
      const nextEditSubjects = availableSubjects.filter((subject) => currentTableSubjectNames.has(subject.name))

      if (nextEditSubjects.length === 0) {
        message.warning('当前列表表头中没有该学生所在年级可编辑的科目')
        return
      }

      const formValues = {}
      nextEditSubjects.forEach((subject) => {
        formValues[buildScoreFieldName(subject.name)] = record.subjects?.[subject.name] ?? null
      })

      setEditingRecord(record)
      setEditSubjects(nextEditSubjects)
      editForm.setFieldsValue(formValues)
      setEditModalOpen(true)
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editingRecord) return
    try {
      const values = await editForm.validateFields()
      for (const subject of visibleSubjectsForEdit) {
        const newScore = values[buildScoreFieldName(subject.name)]
        if (newScore === undefined || newScore === null) continue
        await upsertScore({
          student_id: editingRecord.student_id,
          exam_id: selectedExam,
          subject_id: subject.id,
          score: newScore,
        })
      }
      message.success('成绩修改成功')
      closeEditModal()
      fetchData()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    }
  }

  const handleDeleteStudent = async (studentId) => {
    try {
      await deleteScoreByStudent(selectedExam, studentId)
      message.success('删除成功')
      setSelectedRowKeys((current) => current.filter((key) => key !== studentId))
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDeleteScoresByStudents(selectedExam, selectedRowKeys)
      message.success('批量删除成功')
      setSelectedRowKeys([])
      fetchData()
    } catch (err) {
      message.error(err.message)
    }
  }

  const openImportDialog = () => {
    if (!selectedExam) {
      message.warning('请先选择考试')
      return
    }
    setSelectedImportGrade(null)
    setImportDialogOpen(true)
  }

  const handleImport = async (file) => {
    if (!selectedImportGrade) {
      message.warning('请先选择导入年级')
      return false
    }
    try {
      const res = await importScores(file, selectedExam, selectedImportGrade)
      setImportDialogOpen(false)
      setImportResult(res.data)
      setImportResultOpen(true)
      fetchData()
    } catch (err) {
      if (err?.response?.data?.detail) message.error(err.response.data.detail)
      else if (err.message) message.error(err.message)
    }
    return false
  }

  const handleExport = async () => {
    if (!selectedExam) {
      message.warning('请先选择考试')
      return
    }
    try {
      const params = { exam_id: selectedExam }
      if (selectedClass) params.class_id = selectedClass
      const res = await exportScores(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `scores_${selectedExam}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadScoreTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'score_template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.message)
    }
  }

  const renderRankChange = (text) => {
    if (!text || text === '-') return <span style={{ color: '#999' }}>-</span>
    if (text.startsWith('↑')) return <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{text}</span>
    if (text.startsWith('↓')) return <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{text}</span>
    return text
  }

  const columns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 110, fixed: 'left' },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name', width: 90, fixed: 'left' },
    { title: '班级', dataIndex: 'class_name', key: 'class_name', width: 120 },
    ...visibleSubjects.map((subject) => ({
      title: subject.name,
      key: `subj_${subject.name}`,
      width: 80,
      render: (_, record) => record.subjects?.[subject.name] ?? '-',
    })),
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 80,
      sorter: (a, b) => a.total_score - b.total_score,
    },
    {
      title: '班级排名',
      dataIndex: 'rank_class',
      key: 'rank_class',
      width: 90,
      sorter: (a, b) => (a.rank_class || 999) - (b.rank_class || 999),
    },
    {
      title: '年级排名',
      dataIndex: 'rank_grade',
      key: 'rank_grade',
      width: 90,
      sorter: (a, b) => (a.rank_grade || 999) - (b.rank_grade || 999),
    },
    { title: '班级升降', dataIndex: 'rank_class_change', key: 'rank_class_change', width: 90, render: renderRankChange },
    { title: '年级升降', dataIndex: 'rank_grade_change', key: 'rank_grade_change', width: 90, render: renderRankChange },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<BarChartOutlined />} onClick={() => handleAnalyzeStudent(record.student_id)}>
            分析
          </Button>
          {canManageScores && (
            <>
              <Button size="small" icon={<EditOutlined />} loading={editLoading && editingRecord?.student_id === record.student_id} onClick={() => openEditModal(record)} />
              <Popconfirm title="确认删除该学生本场考试的所有成绩？" onConfirm={() => handleDeleteStudent(record.student_id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const scoreListContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 250 }}
            placeholder="选择考试（必选）"
            value={selectedExam}
            onChange={(value) => {
              setSelectedExam(value)
              setSelectedClass(null)
              setSelectedImportGrade(null)
              setSelectedRowKeys([])
              setPage(1)
            }}
            options={exams.map((exam) => ({ label: `${exam.name} (${exam.exam_date})`, value: exam.id }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            style={{ width: 150 }}
            placeholder="选择班级"
            allowClear
            value={selectedClass}
            onChange={(value) => {
              setSelectedClass(value)
              setPage(1)
            }}
            options={classes.map((item) => ({ label: item.name, value: item.id }))}
          />
          <Input
            style={{ width: 120 }}
            placeholder="学生学号"
            value={searchStudentNo}
            onChange={(event) => setSearchStudentNo(event.target.value)}
            allowClear
            disabled={!selectedExam}
          />
          <Input
            style={{ width: 120 }}
            placeholder="学生姓名"
            value={searchStudentName}
            onChange={(event) => setSearchStudentName(event.target.value)}
            allowClear
            disabled={!selectedExam}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} disabled={!selectedExam}>
            查询
          </Button>
        </Space>

        {canManageScores && (
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal} disabled={!selectedExam}>
              录入成绩
            </Button>
            <Button icon={<UploadOutlined />} onClick={openImportDialog} disabled={!selectedExam}>
              批量导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!selectedExam}>
              导出 Excel
            </Button>
            <Button onClick={handleDownloadTemplate}>下载模板</Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm title={`确认删除已选 ${selectedRowKeys.length} 名学生的成绩？`} onConfirm={handleBatchDelete}>
                <Button danger>删除已选 ({selectedRowKeys.length})</Button>
              </Popconfirm>
            )}
          </Space>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="student_id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        rowSelection={canManageScores ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
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

      <Modal title="录入成绩" open={addModalOpen} onOk={handleAdd} onCancel={closeAddModal} width={520}>
        <Form form={addForm} layout="vertical">
          <Form.Item name="student_id" label="学生" rules={[{ required: true, message: '请选择学生' }]}>
            <Select
              showSearch
              filterOption={(input, option) =>
                String(option?.searchText || option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              placeholder="输入学生姓名或学号联想选择"
              value={selectedEntryStudent}
              loading={entryLoading}
              onChange={handleEntryStudentChange}
              options={students.map((student) => ({
                label: `${student.student_no} - ${student.name}`,
                value: student.id,
                searchText: `${student.student_no || ''} ${student.name || ''}`,
              }))}
            />
          </Form.Item>
          {selectedEntryStudent && entrySubjects.length === 0 && !entryLoading && (
            <div style={{ marginBottom: 12, color: '#94a3b8' }}>该学生所在年级在本场考试下暂无可录入科目</div>
          )}
          {entrySubjects.map((subject) => (
            <Form.Item key={subject.id} name={buildScoreFieldName(subject.id)} label={subject.name}>
              <InputNumber min={0} max={150} style={{ width: '100%' }} placeholder="分数" />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Modal title="批量导入成绩" open={importDialogOpen} onCancel={() => setImportDialogOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Select
            placeholder="选择导入年级"
            value={selectedImportGrade}
            onChange={setSelectedImportGrade}
            options={importGradeOptions.map((grade) => ({ label: grade, value: grade }))}
          />
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport} disabled={!selectedImportGrade}>
            <Button icon={<UploadOutlined />} block disabled={!selectedImportGrade}>
              上传成绩文件
            </Button>
          </Upload>
        </Space>
      </Modal>

      <Modal
        title="导入结果"
        open={importResultOpen}
        onCancel={() => setImportResultOpen(false)}
        footer={<Button onClick={() => setImportResultOpen(false)}>关闭</Button>}
      >
        {importResult && (
          <>
            <p>
              成功导入：<Tag color="green">{importResult.success_count}</Tag> 行
            </p>
            <p>
              失败行数：<Tag color="red">{importResult.error_count}</Tag> 行
            </p>
            {hasMissingClassImportErrors && (
              <Alert
                type="warning"
                showIcon
                message="存在未创建的班级"
                description="请先在班级管理中创建对应年级的班级，再重新导入这些成绩行。"
                style={{ marginBottom: 12 }}
              />
            )}
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

      <Modal title={`编辑成绩 - ${editingRecord?.student_name || ''}`} open={editModalOpen} onOk={handleEdit} onCancel={closeEditModal} width={520}>
        <div style={{ marginBottom: 12, color: '#64748b' }}>仅展示当前列表表头中出现且该学生所在年级可录入的科目。</div>
        <Form form={editForm} layout="vertical">
          {visibleSubjectsForEdit.map((subject) => (
            <Form.Item key={subject.id} name={buildScoreFieldName(subject.name)} label={subject.name}>
              <InputNumber min={0} max={150} style={{ width: '100%' }} placeholder="分数" />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  )

  const tabItems = [
    { key: 'list', label: '成绩列表', children: scoreListContent },
    {
      key: 'student-analysis',
      label: '学生成绩分析',
      children: <StudentAnalysis initialStudentId={analysisStudentId} examId={selectedExam} />,
    },
  ]

  if (canViewClassAnalysis) {
    tabItems.push({
      key: 'class-analysis',
      label: '班级成绩分析',
      children: <ClassAnalysis examId={selectedExam} examGrades={parseExamGrades(selectedExamInfo?.grade)} />,
    })
  }

  return <Tabs activeKey={activeTab} onChange={setActiveTab} destroyInactiveTabPane items={tabItems} />
}


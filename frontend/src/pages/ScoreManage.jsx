import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Select, Space, message, Modal, Form, InputNumber, Upload, Tag, Tabs, Input, Popconfirm,
} from 'antd'
import { PlusOutlined, UploadOutlined, DownloadOutlined, SearchOutlined, BarChartOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  getScores, createScore, updateScore, upsertScore, importScores, exportScores, downloadScoreTemplate,
  deleteScoreByStudent, batchDeleteScoresByStudents,
} from '../api/score'
import { getExams } from '../api/exam'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import { getStudents } from '../api/student'
import { useAuth } from '../contexts/AuthContext'
import StudentAnalysis from './StudentAnalysis'
import ClassAnalysis from './ClassAnalysis'

const SUBJECT_DISPLAY_ORDER = ['语文', '数学', '英语', '物理', '生物', '历史', '地理', '道法', '政治', '化学']

const parseExamGrades = (gradeText) => {
  if (!gradeText) return []
  return gradeText
    .replaceAll('，', ',')
    .replaceAll('、', ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
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
  const [selectedImportGrade, setSelectedImportGrade] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [searchStudentNo, setSearchStudentNo] = useState('')
  const [searchStudentName, setSearchStudentName] = useState('')
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const handleAnalyzeStudent = (studentId) => {
    setAnalysisStudentId(studentId)
    setActiveTab('student-analysis')
  }

  useEffect(() => {
    getExams().then((res) => setExams(res.data)).catch(() => {})
    getClasses().then((res) => setClasses(res.data)).catch(() => {})
    getSubjects().then((res) => setSubjects(res.data)).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedExam) return
    setLoading(true)
    try {
      const params = { exam_id: selectedExam, page, page_size: pageSize }
      if (selectedClass) params.class_id = selectedClass
      if (searchStudentNo) params.student_no = searchStudentNo
      if (searchStudentName) params.student_name = searchStudentName
      const res = await getScores(params)
      setData(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedExam, selectedClass, searchStudentNo, searchStudentName, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = () => {
    setPage(1)
    setSelectedRowKeys([])
    fetchData()
  }

  const openAddModal = async () => {
    addForm.resetFields()
    try {
      const params = {}
      if (selectedClass) params.class_id = selectedClass
      const res = await getStudents({ ...params, page_size: 1000 })
      setStudents(res.data.items)
    } catch { /* empty */ }
    setAddModalOpen(true)
  }

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields()
      for (const subj of sortedSubjects) {
        const score = values[`score_${subj.id}`]
        if (score !== undefined && score !== null) {
          await createScore({
            student_id: values.student_id,
            exam_id: selectedExam,
            subject_id: subj.id,
            score,
          })
        }
      }
      message.success('成绩录入成功')
      setAddModalOpen(false)
      fetchData()
    } catch (err) {
      if (err.message) message.error(err.message)
    }
  }

  const openEditModal = (record) => {
    setEditingRecord(record)
    const formValues = {}
    sortedSubjects.forEach((subj) => {
      formValues[`score_${subj.id}`] = record.subjects?.[subj.name] ?? null
    })
    editForm.setFieldsValue(formValues)
    setEditModalOpen(true)
  }

  const handleEdit = async () => {
    if (!editingRecord) return
    try {
      const values = await editForm.validateFields()

      for (const subj of sortedSubjects) {
        const newScore = values[`score_${subj.id}`]
        if (newScore !== undefined && newScore !== null) {
          await upsertScore({
            student_id: editingRecord.student_id,
            exam_id: selectedExam,
            subject_id: subj.id,
            score: newScore,
          })
        }
      }
      message.success('成绩修改成功')
      setEditModalOpen(false)
      setEditingRecord(null)
      fetchData()
    } catch (err) {
      if (err.message) message.error(err.message)
    }
  }

  const handleDeleteStudent = async (studentId) => {
    try {
      await deleteScoreByStudent(selectedExam, studentId)
      message.success('删除成功')
      setSelectedRowKeys(selectedRowKeys.filter((k) => k !== studentId))
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

  const handleImport = async (file) => {
    if (!selectedExam) {
      message.warning('请先选择考试')
      return false
    }
    if (!selectedImportGrade) {
      message.warning('请先选择导入年级')
      return false
    }
    try {
      const res = await importScores(file, selectedExam, selectedImportGrade)
      setImportResult(res.data)
      setImportModalOpen(true)
      fetchData()
    } catch (err) {
      message.error(err.message)
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

  // Sort subjects by predefined order, only show subjects that have data in current results
  const sortedSubjects = [...subjects].sort((a, b) => {
    const ai = SUBJECT_DISPLAY_ORDER.indexOf(a.name)
    const bi = SUBJECT_DISPLAY_ORDER.indexOf(b.name)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // Determine which subjects have data in current results
  const subjectsWithData = new Set()
  data.forEach((item) => {
    if (item.subjects) {
      Object.keys(item.subjects).forEach((name) => subjectsWithData.add(name))
    }
  })

  const visibleSubjects = data.length > 0
    ? sortedSubjects.filter((s) => subjectsWithData.has(s.name))
    : sortedSubjects

  const columns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 110, fixed: 'left' },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name', width: 90, fixed: 'left' },
    { title: '班级', dataIndex: 'class_name', key: 'class_name', width: 120 },
    ...visibleSubjects.map((subj) => ({
      title: subj.name,
      key: `subj_${subj.id}`,
      width: 80,
      render: (_, record) => record.subjects?.[subj.name] ?? '-',
    })),
    { title: '总分', dataIndex: 'total_score', key: 'total_score', width: 80, defaultSortOrder: 'descend', sorter: (a, b) => a.total_score - b.total_score },
    { title: '班级排名', dataIndex: 'rank_class', key: 'rank_class', width: 90, sorter: (a, b) => (a.rank_class || 999) - (b.rank_class || 999) },
    { title: '年级排名', dataIndex: 'rank_grade', key: 'rank_grade', width: 90, sorter: (a, b) => (a.rank_grade || 999) - (b.rank_grade || 999) },
    { title: '班级升降', dataIndex: 'rank_class_change', key: 'rank_class_change', width: 90, render: renderRankChange },
    { title: '年级升降', dataIndex: 'rank_grade_change', key: 'rank_grade_change', width: 90, render: renderRankChange },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => handleAnalyzeStudent(record.student_id)}
          >分析</Button>
          {canManageScores && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
              <Popconfirm
                title="确认删除该学生本次考试的所有成绩？"
                onConfirm={() => handleDeleteStudent(record.student_id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const canManageScores = ['admin', 'school_admin', 'teacher'].includes(user?.role)
  const canViewClassAnalysis = user?.role !== 'student'
  const selectedExamInfo = exams.find((exam) => exam.id === selectedExam)
  const importGradeOptions = parseExamGrades(selectedExamInfo?.grade)
  const scoreListContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 250 }}
            placeholder="选择考试（必选）"
            value={selectedExam}
            onChange={(v) => {
              setSelectedExam(v)
              setSelectedImportGrade(null)
              setPage(1)
              setSelectedRowKeys([])
            }}
            options={exams.map((e) => ({ label: `${e.name} (${e.exam_date})`, value: e.id }))}
            showSearch
            optionFilterProp="label"
          />
          {canManageScores && (
            <Select
              style={{ width: 160 }}
              placeholder="导入年级"
              allowClear
              value={selectedImportGrade}
              disabled={!selectedExam}
              onChange={setSelectedImportGrade}
              options={importGradeOptions.map((grade) => ({ label: grade, value: grade }))}
            />
          )}
          <Select
            style={{ width: 150 }}
            placeholder="班级筛选"
            allowClear
            value={selectedClass}
            onChange={(v) => { setSelectedClass(v); setPage(1) }}
            options={classes.map((c) => ({ label: c.name, value: c.id }))}
          />
          <Input
            style={{ width: 120 }}
            placeholder="学号"
            value={searchStudentNo}
            onChange={(e) => setSearchStudentNo(e.target.value)}
            allowClear
            disabled={!selectedExam}
          />
          <Input
            style={{ width: 120 }}
            placeholder="姓名"
            value={searchStudentName}
            onChange={(e) => setSearchStudentName(e.target.value)}
            allowClear
            disabled={!selectedExam}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} disabled={!selectedExam}>查询</Button>
        </Space>
        {canManageScores && (
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal} disabled={!selectedExam}>录入成绩</Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<UploadOutlined />}>批量导入</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!selectedExam}>导出 Excel</Button>
            <Button onClick={handleDownloadTemplate}>下载模板</Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确认删除选中的 ${selectedRowKeys.length} 名学生的成绩？`}
                onConfirm={handleBatchDelete}
              >
                <Button danger>删除所选 ({selectedRowKeys.length})</Button>
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
        rowSelection={canManageScores ? {
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        } : undefined}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
      />

      <Modal title="录入成绩" open={addModalOpen} onOk={handleAdd} onCancel={() => setAddModalOpen(false)} width={500}>
        <Form form={addForm} layout="vertical">
          <Form.Item name="student_id" label="学生" rules={[{ required: true, message: '请选择学生' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="搜索学生"
              options={students.map((s) => ({ label: `${s.student_no} - ${s.name}`, value: s.id }))}
            />
          </Form.Item>
          {sortedSubjects.map((subj) => (
            <Form.Item key={subj.id} name={`score_${subj.id}`} label={subj.name}>
              <InputNumber min={0} max={150} style={{ width: '100%' }} placeholder="分数" />
            </Form.Item>
          ))}
        </Form>
      </Modal>

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
        title={`编辑成绩 - ${editingRecord?.student_name}`}
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => { setEditModalOpen(false); setEditingRecord(null) }}
        width={500}
      >
        <Form form={editForm} layout="vertical">
          {sortedSubjects.map((subj) => (
            <Form.Item key={subj.id} name={`score_${subj.id}`} label={subj.name}>
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
      children: (
        <StudentAnalysis
          initialStudentId={analysisStudentId}
          examId={selectedExam}
        />
      ),
    },
  ]

  if (canViewClassAnalysis) {
    tabItems.push({
      key: 'class-analysis',
      label: '班级成绩分析',
      children: <ClassAnalysis examId={selectedExam} />,
    })
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      destroyInactiveTabPane
      items={tabItems}
    />
  )
}

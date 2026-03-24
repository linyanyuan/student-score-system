import { useState, useEffect } from 'react'
import { Row, Col, Card, Select, Spin, Empty, Typography } from 'antd'
import { Line, Radar } from '@ant-design/charts'
import { getStudents } from '../api/student'
import { getSubjects } from '../api/subject'
import { getExams } from '../api/exam'
import { getClasses } from '../api/class'
import { useAuth } from '../contexts/AuthContext'
import {
  getStudentTotalTrend,
  getStudentSubjectTrend,
  getStudentRankTrend,
  getStudentSubjectComparison,
} from '../api/analysis'

const { Text } = Typography

const parseExamGrades = (gradeValue) => {
  if (!gradeValue) return []
  return String(gradeValue)
    .split(/[，,、]/)
    .map((g) => g.trim())
    .filter(Boolean)
}

export default function StudentAnalysis({ initialStudentId, examId: initialExamId }) {
  const { user } = useAuth()
  const isStudentRole = user?.role === 'student'
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [studentId, setStudentId] = useState(initialStudentId || user?.student_id || null)
  const [subjectId, setSubjectId] = useState(null)
  const [selectedExamId, setSelectedExamId] = useState(initialExamId || null)
  const [loading, setLoading] = useState(false)

  const [totalTrend, setTotalTrend] = useState([])
  const [subjectTrend, setSubjectTrend] = useState([])
  const [rankTrend, setRankTrend] = useState([])
  const [subjectComparison, setSubjectComparison] = useState([])

  // Load students, subjects, exams, classes on mount
  useEffect(() => {
    if (isStudentRole) {
      const boundStudentId = user?.student_id ?? null
      setStudentId(boundStudentId)
      setStudents(
        boundStudentId
          ? [{
              id: boundStudentId,
              name: user?.student_name || user?.username || '当前学生',
              student_no: user?.student_no || '',
              class_id: null,
            }]
          : []
      )
    } else {
      getStudents({ page: 1, page_size: 9999 })
        .then((res) => {
          setStudents(res.data?.items || [])
        })
        .catch(() => {
          setStudents([])
        })
    }
    getSubjects().then((res) => {
      const list = res.data || []
      setSubjects(list)
      if (list.length > 0) setSubjectId(list[0].id)
    }).catch(() => setSubjects([]))
    getExams().then((res) => {
      setExams(res.data || [])
    }).catch(() => setExams([]))
    getClasses().then((res) => {
      setClasses(res.data || [])
    }).catch(() => setClasses([]))
  }, [isStudentRole, user?.student_id, user?.student_name, user?.student_no, user?.username])

  // Sync initialStudentId from parent
  useEffect(() => {
    if (!isStudentRole && initialStudentId) setStudentId(initialStudentId)
  }, [isStudentRole, initialStudentId])

  // Sync initialExamId from parent
  useEffect(() => {
    if (initialExamId) setSelectedExamId(initialExamId)
  }, [initialExamId])

  // Get student's grade and filter exams accordingly
  const selectedStudent = students.find((s) => s.id === studentId)
  const studentClass = selectedStudent ? classes.find((c) => c.id === selectedStudent.class_id) : null
  const studentGrade = studentClass?.grade

  // Filter exams by student's grade, sorted by date descending
  const filteredExams = studentGrade
    ? [...exams]
        .filter((e) => parseExamGrades(e.grade).includes(studentGrade))
        .sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date))
    : [...exams].sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date))

  // Auto-select most recent exam when student changes
  useEffect(() => {
    if (studentId && filteredExams.length > 0 && !selectedExamId) {
      setSelectedExamId(filteredExams[0].id)
    }
  }, [studentId, filteredExams, selectedExamId])

  // Fetch analysis data when studentId changes
  useEffect(() => {
    if (!studentId || typeof studentId !== 'number') {
      setTotalTrend([])
      setRankTrend([])
      return
    }
    setLoading(true)
    Promise.all([
      getStudentTotalTrend(studentId),
      getStudentRankTrend(studentId),
    ])
      .then(([totalRes, rankRes]) => {
        setTotalTrend(totalRes.data || [])
        setRankTrend(rankRes.data || [])
      })
      .catch(() => {
        setTotalTrend([])
        setRankTrend([])
      })
      .finally(() => setLoading(false))
  }, [studentId])

  // Fetch subject comparison when studentId or selectedExamId changes
  useEffect(() => {
    if (!studentId || typeof studentId !== 'number' || !selectedExamId) {
      setSubjectComparison([])
      return
    }
    getStudentSubjectComparison(studentId, selectedExamId)
      .then((res) => {
        setSubjectComparison(res.data || [])
      })
      .catch(() => {
        setSubjectComparison([])
      })
  }, [studentId, selectedExamId])

  // Fetch subject trend when studentId or subjectId changes
  useEffect(() => {
    if (!studentId || typeof studentId !== 'number' || !subjectId) {
      setSubjectTrend([])
      return
    }
    getStudentSubjectTrend(studentId, subjectId)
      .then((res) => {
        setSubjectTrend(res.data || [])
      })
      .catch(() => {
        setSubjectTrend([])
      })
  }, [studentId, subjectId])
  // Chart configs
  const totalTrendConfig = {
    data: totalTrend,
    xField: 'exam_name',
    yField: 'total_score',
    point: { size: 4, shape: 'circle' },
    label: { dy:-10,style: { fill: '#f50404' ,fontWeight: 600,} },
    smooth: true,
    tooltip: {
      title: (d) => d.exam_name,
      items: [{ field: 'total_score', name: '总分' }],
    },
    style: {
      lineWidth: 2,
    },
  }

  const subjectTrendConfig = {
    data: subjectTrend,
    xField: 'exam_name',
    yField: 'score',
    point: { size: 4, shape: 'circle' },
    label: { dy:-10,style: { fill: '#f50404' ,fontWeight: 600,} },
    smooth: true,
    tooltip: {
      title: (d) => d.exam_name,
      items: [{ field: 'score', name: '分数' }],
    },
    style: {
      lineWidth: 2,
    },
  }

  // Rank trend: two lines (班级排名 + 年级排名)
  const rankTrendData = rankTrend.flatMap((d) => [
    { exam_name: d.exam_name, rank: d.rank_class, type: '班级排名' },
    { exam_name: d.exam_name, rank: d.rank_grade, type: '年级排名' },
  ])
  const rankTrendConfig = {
    data: rankTrendData,
    xField: 'exam_name',
    yField: 'rank',
    seriesField: 'type',
    colorField: 'type',
    axis: { y: { nice: true, reverse: true } },
    point: { size: 4 },
    smooth: true,
    legend: { position: 'top' },
    label: { dy:-10,style: { fill: '#f50404' ,fontWeight: 600,} },
    tooltip: {
      title: (d) => d.exam_name,
      items: [{ field: 'rank', name: (d) => d.type }],
    },
    style: {
      lineWidth: 2,
    },
  }

  // Radar: subject comparison
  const radarData = subjectComparison.flatMap((d) => [
    { subject: d.subject_name, score: d.student_score ?? 0, type: '本人' },
    { subject: d.subject_name, score: d.class_avg ?? 0, type: '班级均分' },
    { subject: d.subject_name, score: d.grade_avg ?? 0, type: '年级均分' },
  ])
  const radarConfig = {
    data: radarData,
    xField: 'subject',
    yField: 'score',
    seriesField: 'type',
    colorField: 'type',
    meta: { score: { min: 0, max: 150 } },
    legend: { position: 'top' },
    
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: s.name,
  }))

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text>{isStudentRole ? '当前学生：' : '选择学生：'}</Text>
          <Select
            showSearch={!isStudentRole}
            disabled={isStudentRole}
            placeholder="搜索学号或姓名"
            style={{ width: 220 }}
            value={studentId}
            onChange={setStudentId}
            options={studentOptions}
            filterOption={(input, option) =>
              (option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Col>
      </Row>

      {!studentId ? (
        <Empty description="请选择学生" />
      ) : (
        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="总分历次趋势" size="small">
                {totalTrend.length > 0 ? (
                  <Line {...totalTrendConfig} height={260} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title="单科历次趋势"
                size="small"
                extra={
                  <Select
                    size="small"
                    style={{ width: 100 }}
                    value={subjectId}
                    onChange={setSubjectId}
                    options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                  />
                }
              >
                {subjectTrend.length > 0 ? (
                  <Line {...subjectTrendConfig} height={260} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="名次变化" size="small">
                {rankTrend.length > 0 ? (
                  <Line {...rankTrendConfig} height={260} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title="各科成绩对比（雷达图）"
                size="small"
                extra={
                  <Select
                    size="small"
                    style={{ width: 180 }}
                    placeholder="选择考试"
                    value={selectedExamId}
                    onChange={setSelectedExamId}
                    options={filteredExams.map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.exam_date})`,
                    }))}
                  />
                }
              >
                {subjectComparison.length > 0 ? (
                  <Radar {...radarConfig} height={260} />
                ) : (
                  <Empty description="请先选择考试" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>
        </Spin>
      )}
    </div>
  )
}

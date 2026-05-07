import { useEffect, useState } from 'react'
import { Row, Col, Card, Select, Spin, Empty, Typography } from 'antd'
import { Line, Radar } from '@ant-design/charts'
import { getStudents } from '../api/student'
import { getSubjects } from '../api/subject'
import { getExams } from '../api/exam'
import { getClasses } from '../api/class'
import { useAuth } from '../contexts/AuthContext'
import {
  buildRadarSubjectPoints,
  buildSubjectScoreComparisonLineSeries,
  buildTotalScoreComparisonBars,
} from './studentAnalysisUtils'
import {
  getStudentRankTrend,
  getStudentScoreComparison,
  getStudentSubjectComparison,
  getStudentSubjectTrend,
  getStudentTotalTrend,
} from '../api/analysis'

const { Text } = Typography

const COMPARISON_STYLE = {
  当前学生: { color: '#3155a4', label: '本人' },
  班级均分: { color: '#2c9aa0', label: '班级' },
  年级均分: { color: '#c98213', label: '年级' },
  最高分: { color: '#b84a4a', label: '最高' },
}

const parseExamGrades = (gradeValue) => {
  if (!gradeValue) return []
  return String(gradeValue)
    .split(/[，,、/]/)
    .map((grade) => grade.trim())
    .filter(Boolean)
}

function ScoreComparisonList({ data }) {
  const maxScore = Math.max(...data.map((item) => Number(item?.score || 0)), 1)

  return (
    <div className="student-analysis-comparison-list">
      {data.map((item) => {
        const score = Number(item?.score || 0)
        const style = COMPARISON_STYLE[item.label] || { color: '#64748b', label: item.label }
        return (
          <div className="student-analysis-comparison-row" key={item.label}>
            <div className="student-analysis-comparison-meta">
              <span style={{ color: style.color, borderColor: `${style.color}33`, background: `${style.color}12` }}>
                {style.label}
              </span>
              <strong>{item.label}</strong>
            </div>
            <div className="student-analysis-comparison-track" aria-hidden="true">
              <span
                className="student-analysis-comparison-fill"
                style={{ width: `${Math.max((score / maxScore) * 100, 4)}%`, background: style.color }}
              />
            </div>
            <b>{score.toFixed(2)}</b>
          </div>
        )
      })}
    </div>
  )
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
  const [scoreComparison, setScoreComparison] = useState([])

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
              class_id: user?.class_id ?? null,
            }]
          : []
      )
    } else {
      getStudents({ page: 1, page_size: 9999 })
        .then((res) => setStudents(res.data?.items || []))
        .catch(() => setStudents([]))
    }

    getSubjects()
      .then((res) => {
        const list = res.data || []
        setSubjects(list)
        if (list.length > 0) setSubjectId(list[0].id)
      })
      .catch(() => setSubjects([]))

    getExams().then((res) => setExams(res.data || [])).catch(() => setExams([]))
    getClasses().then((res) => setClasses(res.data || [])).catch(() => setClasses([]))
  }, [isStudentRole, user?.class_id, user?.student_id, user?.student_name, user?.student_no, user?.username])

  useEffect(() => {
    if (!isStudentRole && initialStudentId) setStudentId(initialStudentId)
  }, [initialStudentId, isStudentRole])

  useEffect(() => {
    if (initialExamId) setSelectedExamId(initialExamId)
  }, [initialExamId])

  const selectedStudent = students.find((student) => student.id === studentId)
  const studentClass = selectedStudent ? classes.find((item) => item.id === selectedStudent.class_id) : null
  const studentGrade = studentClass?.grade

  const filteredExams = studentGrade
    ? [...exams]
        .filter((exam) => parseExamGrades(exam.grade).includes(studentGrade))
        .sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date))
    : [...exams].sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date))

  useEffect(() => {
    if (!studentId) {
      setSelectedExamId(null)
      return
    }
    if (filteredExams.length === 0) {
      setSelectedExamId(null)
      return
    }
    if (!selectedExamId || !filteredExams.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(filteredExams[0].id)
    }
  }, [filteredExams, selectedExamId, studentId])

  useEffect(() => {
    if (!studentId || typeof studentId !== 'number') {
      setTotalTrend([])
      setRankTrend([])
      return
    }

    setLoading(true)
    Promise.all([getStudentTotalTrend(studentId), getStudentRankTrend(studentId)])
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

  useEffect(() => {
    if (!studentId || typeof studentId !== 'number' || !selectedExamId) {
      setSubjectComparison([])
      setScoreComparison([])
      return
    }

    Promise.all([
      getStudentSubjectComparison(studentId, selectedExamId),
      getStudentScoreComparison(studentId, selectedExamId),
    ])
      .then(([subjectRes, scoreRes]) => {
        setSubjectComparison(subjectRes.data || [])
        setScoreComparison(scoreRes.data || [])
      })
      .catch(() => {
        setSubjectComparison([])
        setScoreComparison([])
      })
  }, [selectedExamId, studentId])

  useEffect(() => {
    if (!studentId || typeof studentId !== 'number' || !subjectId) {
      setSubjectTrend([])
      return
    }

    getStudentSubjectTrend(studentId, subjectId)
      .then((res) => setSubjectTrend(res.data || []))
      .catch(() => setSubjectTrend([]))
  }, [studentId, subjectId])

  const totalTrendConfig = {
    data: totalTrend,
    xField: 'exam_name',
    yField: 'total_score',
    point: { size: 3, shape: 'circle' },
    smooth: true,
    axis: {
      x: { title: false, labelFill: '#64748b' },
      y: { title: false, gridStroke: '#edf2f7', labelFill: '#94a3b8' },
    },
    tooltip: {
      title: (datum) => datum.exam_name,
      items: [{ field: 'total_score', name: '总分' }],
    },
    style: { lineWidth: 2.4, stroke: '#3155a4' },
  }

  const subjectTrendConfig = {
    data: subjectTrend,
    xField: 'exam_name',
    yField: 'score',
    point: { size: 3, shape: 'circle' },
    smooth: true,
    axis: {
      x: { title: false, labelFill: '#64748b' },
      y: { title: false, gridStroke: '#edf2f7', labelFill: '#94a3b8' },
    },
    tooltip: {
      title: (datum) => datum.exam_name,
      items: [{ field: 'score', name: '分数' }],
    },
    style: { lineWidth: 2.4, stroke: '#2c9aa0' },
  }

  const rankTrendData = rankTrend.flatMap((row) => [
    { exam_name: row.exam_name, rank: row.rank_class, type: '班级排名' },
    { exam_name: row.exam_name, rank: row.rank_grade, type: '年级排名' },
  ])

  const rankTrendConfig = {
    data: rankTrendData,
    xField: 'exam_name',
    yField: 'rank',
    seriesField: 'type',
    colorField: 'type',
    point: { size: 3 },
    smooth: true,
    legend: { position: 'top' },
    scale: {
      color: { range: ['#3155a4', '#c98213'] },
      y: { nice: true, range: [0, 1] },
    },
    axis: {
      x: { title: false, labelFill: '#64748b' },
      y: { title: false, gridStroke: '#edf2f7', labelFill: '#94a3b8' },
    },
    tooltip: {
      title: (datum) => datum.exam_name,
      items: [{ field: 'rank', name: (datum) => datum.type }],
    },
    style: { lineWidth: 2 },
  }

  const radarData = buildRadarSubjectPoints(subjectComparison)
  const radarConfig = {
    data: radarData,
    xField: 'subject',
    yField: 'score_rate',
    axis: {
      y: { nice: false, gridStroke: '#e8eef7', labelFill: '#94a3b8' },
      x: { labelFill: '#526174', labelFontWeight: 700 },
    },
    area: { style: { fillOpacity: 0.18, fill: '#3155a4' } },
    scale: {
      y: {
        min: 0,
        max: 100,
        domain: [0, 100],
        nice: false,
      },
    },
    tooltip: {
      title: (datum) => datum.subject,
      items: [
        { field: 'student_score', name: '分数' },
        { field: 'full_score', name: '满分' },
        { field: 'score_rate', name: '得分率(%)' },
      ],
    },
    legend: false,
    style: { stroke: '#3155a4', lineWidth: 2 },
  }

  const studentOptions = students.map((student) => ({
    value: student.id,
    label: student.name,
  }))

  const totalScoreBarData = buildTotalScoreComparisonBars(scoreComparison)
  const subjectScoreLineData = buildSubjectScoreComparisonLineSeries(scoreComparison)
  const subjectScoreLineConfig = {
    data: subjectScoreLineData,
    xField: 'dimension',
    yField: 'score',
    seriesField: 'series',
    colorField: 'series',
    point: { size: 4, shape: 'circle' },
    smooth: true,
    legend: { position: 'top' },
    scale: {
      color: { range: ['#3155a4', '#2c9aa0', '#c98213', '#b84a4a'] },
    },
    axis: {
      x: { title: false, labelFill: '#64748b' },
      y: { title: false, gridStroke: '#edf2f7', labelFill: '#94a3b8' },
    },
    tooltip: {
      title: (datum) => datum.dimension,
      items: [{ field: 'score', name: (datum) => datum.series }],
    },
    style: { lineWidth: 2 },
  }

  return (
    <div className="student-analysis-page">
      <div className="student-analysis-pivot">
        <div className="student-analysis-pivot-copy">
          <span className="student-analysis-kicker">学生成绩分析</span>
          <Text className="student-analysis-title">
            {selectedStudent?.name || '请选择学生'}
          </Text>
          {selectedStudent && (
            <div className="student-analysis-meta-line">
              <span>学号 {selectedStudent.student_no || '-'}</span>
              <span>班级 {studentClass?.name || '-'}</span>
              <span>年级 {studentGrade || '-'}</span>
            </div>
          )}
        </div>
        <div className="student-analysis-picker-wrap">
          <Text className="class-analysis-picker-label">{isStudentRole ? '当前学生' : '选择学生'}</Text>
          <Select
            showSearch={!isStudentRole}
            disabled={isStudentRole}
            placeholder="搜索学号或姓名"
            className="student-analysis-picker"
            value={studentId}
            onChange={setStudentId}
            options={studentOptions}
            filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
          />
        </div>
      </div>

      {!studentId ? (
        <div className="student-analysis-empty-prompt">
          <Empty description="请选择学生" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card className="class-analysis-panel-card student-analysis-card" title="总分历次趋势" size="small">
                {totalTrend.length > 0 ? (
                  <div className="student-analysis-chart-frame">
                    <Line {...totalTrendConfig} height={260} />
                  </div>
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                className="class-analysis-panel-card student-analysis-card"
                title="单科分数历次趋势"
                size="small"
                extra={(
                  <Select
                    size="small"
                    style={{ width: 100 }}
                    value={subjectId}
                    onChange={setSubjectId}
                    options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
                  />
                )}
              >
                {subjectTrend.length > 0 ? (
                  <div className="student-analysis-chart-frame">
                    <Line {...subjectTrendConfig} height={260} />
                  </div>
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card className="class-analysis-panel-card student-analysis-card" title="名次变化" size="small">
                {rankTrend.length > 0 ? (
                  <div className="student-analysis-chart-frame">
                    <Line {...rankTrendConfig} height={260} />
                  </div>
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                className="class-analysis-panel-card student-analysis-card"
                title="各科成绩对比（雷达图，顶点为满分）"
                size="small"
                extra={(
                  <Select
                    size="small"
                    style={{ width: 180 }}
                    placeholder="选择考试"
                    value={selectedExamId}
                    onChange={setSelectedExamId}
                    options={filteredExams.map((exam) => ({
                      value: exam.id,
                      label: `${exam.name} (${exam.exam_date})`,
                    }))}
                  />
                )}
              >
                {subjectComparison.length > 0 ? (
                  <div className="student-analysis-chart-frame">
                    <Radar {...radarConfig} height={260} />
                  </div>
                ) : (
                  <Empty description="请先选择考试" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card className="class-analysis-panel-card student-analysis-card" title="总分对比" size="small">
                {totalScoreBarData.length > 0 ? (
                  <ScoreComparisonList data={totalScoreBarData} />
                ) : (
                  <Empty description="请先选择考试" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={16}>
              <Card className="class-analysis-panel-card student-analysis-card" title="各科成绩对比" size="small">
                {subjectScoreLineData.length > 0 ? (
                  <div className="student-analysis-chart-frame">
                    <Line {...subjectScoreLineConfig} height={320} />
                  </div>
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

import { useState, useEffect } from 'react'
import { Row, Col, Card, Select, Spin, Empty, Typography } from 'antd'
import { Line, Radar } from '@ant-design/charts'
import { getStudents } from '../api/student'
import { getSubjects } from '../api/subject'
import {
  getStudentTotalTrend,
  getStudentSubjectTrend,
  getStudentRankTrend,
  getStudentSubjectComparison,
} from '../api/analysis'

const { Text } = Typography

export default function StudentAnalysis({ initialStudentId, examId }) {
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [studentId, setStudentId] = useState(initialStudentId || null)
  const [subjectId, setSubjectId] = useState(null)
  const [loading, setLoading] = useState(false)

  const [totalTrend, setTotalTrend] = useState([])
  const [subjectTrend, setSubjectTrend] = useState([])
  const [rankTrend, setRankTrend] = useState([])
  const [subjectComparison, setSubjectComparison] = useState([])

  // Load students and subjects on mount
  useEffect(() => {
    getStudents({ page: 1, page_size: 200 }).then((res) => {
      setStudents(res.data?.items || [])
    })
    getSubjects().then((res) => {
      const list = res.data || []
      setSubjects(list)
      if (list.length > 0) setSubjectId(list[0].id)
    })
  }, [])

  // Sync initialStudentId from parent
  useEffect(() => {
    if (initialStudentId) setStudentId(initialStudentId)
  }, [initialStudentId])

  // Fetch analysis data when studentId changes
  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    Promise.all([
      getStudentTotalTrend(studentId),
      getStudentRankTrend(studentId),
      examId ? getStudentSubjectComparison(studentId, examId) : Promise.resolve({ data: [] }),
    ])
      .then(([totalRes, rankRes, compRes]) => {
        setTotalTrend(totalRes.data || [])
        setRankTrend(rankRes.data || [])
        setSubjectComparison(compRes.data || [])
      })
      .finally(() => setLoading(false))
  }, [studentId, examId])

  // Fetch subject trend when studentId or subjectId changes
  useEffect(() => {
    if (!studentId || !subjectId) return
    getStudentSubjectTrend(studentId, subjectId).then((res) => {
      setSubjectTrend(res.data || [])
    })
  }, [studentId, subjectId])

  // Chart configs
  const totalTrendConfig = {
    data: totalTrend,
    xField: 'exam_name',
    yField: 'total_score',
    point: { size: 4, shape: 'circle' },
    label: { style: { fill: '#aaa' } },
    smooth: true,
  }

  const subjectTrendConfig = {
    data: subjectTrend,
    xField: 'exam_name',
    yField: 'score',
    point: { size: 4, shape: 'circle' },
    smooth: true,
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
    yAxis: { nice: true, reverse: true },
    point: { size: 4 },
    smooth: true,
    legend: { position: 'top' },
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
    meta: { score: { min: 0, max: 150 } },
    legend: { position: 'top' },
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.student_no} - ${s.name}`,
  }))

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text>选择学生：</Text>
          <Select
            showSearch
            placeholder="搜索学号或姓名"
            style={{ width: 220 }}
            value={studentId}
            onChange={setStudentId}
            options={studentOptions}
            filterOption={(input, option) =>
              option.label.toLowerCase().includes(input.toLowerCase())
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
              <Card title="各科成绩对比（雷达图）" size="small">
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

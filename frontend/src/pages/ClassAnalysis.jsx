import { useState, useEffect } from 'react'
import { Row, Col, Card, Select, Table, Tag, Spin, Empty, Typography } from 'antd'
import { Column } from '@ant-design/charts'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import {
  getClassesRank,
  getClassDistribution,
  getClassBottomStudents,
  getClassBiasedStudents,
} from '../api/analysis'

const { Text } = Typography

function DistributionChart({ data, title }) {
  if (!data) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  const chartData = [
    { type: '优秀(≥90)', value: data.excellent_rate },
    { type: '良好(80-89)', value: data.good_rate },
    { type: '合格(60-79)', value: data.pass_rate },
    { type: '不合格(<60)', value: data.fail_rate },
  ]
  const config = {
    data: chartData,
    xField: 'type',
    yField: 'value',
    yAxis: { label: { formatter: (v) => `${(v * 100).toFixed(0)}%` } },
    label: { position: 'top', formatter: (d) => `${(d.value * 100).toFixed(1)}%` },
    color: ['#52c41a', '#1890ff', '#faad14', '#ff4d4f'],
    colorField: 'type',
  }
  return <Column {...config} height={220} />
}

export default function ClassAnalysis({ examId }) {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classId, setClassId] = useState(null)
  const [subjectId, setSubjectId] = useState(null)
  const [loading, setLoading] = useState(false)

  const [classesRank, setClassesRank] = useState([])
  const [distribution, setDistribution] = useState(null)
  const [bottomStudents, setBottomStudents] = useState([])
  const [biasedStudents, setBiasedStudents] = useState([])
  const [selectedSubjectDist, setSelectedSubjectDist] = useState('total')

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data || []))
    getSubjects().then((res) => setSubjects(res.data || []))
  }, [])

  // Fetch class rank when examId or subjectId changes
  useEffect(() => {
    if (!examId) return
    getClassesRank(examId, subjectId || undefined).then((res) => {
      setClassesRank(res.data || [])
    })
  }, [examId, subjectId])

  // Fetch single-class analysis when classId or examId changes
  useEffect(() => {
    if (!classId || !examId) return
    setLoading(true)
    Promise.all([
      getClassDistribution(classId, examId),
      getClassBottomStudents(classId, examId),
      getClassBiasedStudents(classId, examId),
    ])
      .then(([distRes, bottomRes, biasedRes]) => {
        setDistribution(distRes.data || null)
        setBottomStudents(bottomRes.data || [])
        setBiasedStudents(biasedRes.data || [])
        setSelectedSubjectDist('total')
      })
      .finally(() => setLoading(false))
  }, [classId, examId])

  // Class rank chart
  const rankConfig = {
    data: classesRank,
    xField: 'class_name',
    yField: 'avg_score',
    label: { position: 'top', formatter: (d) => d.avg_score?.toFixed(1) },
    color: '#1890ff',
    xAxis: { label: { autoRotate: true } },
  }

  // Build subject columns for bottom/biased tables dynamically
  const allSubjectNames = bottomStudents.length > 0
    ? Object.keys(bottomStudents[0].subjects || {})
    : biasedStudents.length > 0
    ? Object.keys(biasedStudents[0].subjects || {})
    : []

  const subjectCols = allSubjectNames.map((name) => ({
    title: name,
    dataIndex: ['subjects', name],
    key: name,
    width: 70,
    render: (val, record) => {
      const isWeak = record.weak_subjects?.includes(name) || record.weak_subject === name
      return (
        <span style={{ color: isWeak ? '#ff4d4f' : undefined, fontWeight: isWeak ? 600 : undefined }}>
          {val ?? '-'}
        </span>
      )
    },
  }))

  const bottomColumns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 100 },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name', width: 80 },
    { title: '总分', dataIndex: 'total_score', key: 'total_score', width: 70 },
    { title: '班级排名', dataIndex: 'rank_class', key: 'rank_class', width: 80 },
    ...subjectCols,
    {
      title: '薄弱科目',
      dataIndex: 'weak_subjects',
      key: 'weak_subjects',
      render: (val) => val?.map((s) => <Tag color="red" key={s}>{s}</Tag>),
    },
  ]

  const biasedColumns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 100 },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name', width: 80 },
    { title: '标准差', dataIndex: 'std_dev', key: 'std_dev', width: 80 },
    ...subjectCols,
    {
      title: '偏科科目',
      dataIndex: 'weak_subject',
      key: 'weak_subject',
      render: (val) => val ? <Tag color="orange">{val}</Tag> : '-',
    },
  ]

  // Distribution subject options
  const distSubjectOptions = distribution
    ? [
        { value: 'total', label: '总分' },
        ...Object.keys(distribution.subjects || {}).map((name) => ({ value: name, label: name })),
      ]
    : [{ value: 'total', label: '总分' }]

  const currentDistData =
    selectedSubjectDist === 'total'
      ? distribution?.total
      : distribution?.subjects?.[selectedSubjectDist]

  return (
    <div>
      {/* Filters */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text>科目（班级排名用）：</Text>
          <Select
            allowClear
            placeholder="总分"
            style={{ width: 120 }}
            value={subjectId}
            onChange={setSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Col>
        <Col>
          <Text>选择班级（深度分析）：</Text>
          <Select
            allowClear
            placeholder="不选则仅显示排名"
            style={{ width: 180 }}
            value={classId}
            onChange={setClassId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Col>
      </Row>

      {!examId ? (
        <Empty description="请先在成绩列表中选择考试" />
      ) : (
        <>
          {/* Class rank chart */}
          <Card title="班级排名" size="small" style={{ marginBottom: 16 }}>
            {classesRank.length > 0 ? (
              <Column {...rankConfig} height={260} />
            ) : (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Single class deep analysis */}
          {classId && (
            <Spin spinning={loading}>
              <Row gutter={[16, 16]}>
                {/* Distribution */}
                <Col xs={24}>
                  <Card
                    title="成绩分布"
                    size="small"
                    extra={
                      <Select
                        size="small"
                        style={{ width: 100 }}
                        value={selectedSubjectDist}
                        onChange={setSelectedSubjectDist}
                        options={distSubjectOptions}
                      />
                    }
                  >
                    <DistributionChart data={currentDistData} />
                  </Card>
                </Col>

                {/* Bottom students */}
                <Col xs={24}>
                  <Card title="后进生分析（总分排名靠后）" size="small">
                    <Table
                      dataSource={bottomStudents}
                      columns={bottomColumns}
                      rowKey="student_no"
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{ emptyText: '暂无数据' }}
                    />
                  </Card>
                </Col>

                {/* Biased students */}
                <Col xs={24}>
                  <Card title="偏科生分析" size="small">
                    <Table
                      dataSource={biasedStudents}
                      columns={biasedColumns}
                      rowKey="student_no"
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{ emptyText: '暂无偏科生' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Spin>
          )}
        </>
      )}
    </div>
  )
}

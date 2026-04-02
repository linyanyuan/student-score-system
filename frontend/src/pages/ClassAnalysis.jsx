import { useEffect, useState } from 'react'
import { Row, Col, Card, Select, Table, Tag, Spin, Empty, Typography, Tooltip, Divider } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { Bar, Column } from '@ant-design/charts'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import { buildRankChartRowsWithGradeAverage } from './studentAnalysisUtils'
import {
  getClassBiasedStudents,
  getClassBottomStudents,
  getClassDistribution,
  getClassesRank,
  getExamSubjectThreeRatesOneScoreRank,
} from '../api/analysis'

const { Text } = Typography

function DistributionChart({ data }) {
  if (!data || (data.excellent_rate === 0 && data.good_rate === 0 && data.pass_rate === 0 && data.fail_rate === 0)) {
    return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  const chartData = [
    { type: '优秀(≥90%)', value: data.excellent_rate || 0, count: data.excellent_count || 0 },
    { type: '良好(80-89%)', value: data.good_rate || 0, count: data.good_count || 0 },
    { type: '合格(60-79%)', value: data.pass_rate || 0, count: data.pass_count || 0 },
    { type: '不合格(<60%)', value: data.fail_rate || 0, count: data.fail_count || 0 },
  ]

  const config = {
    data: chartData,
    xField: 'type',
    yField: 'value',
    axis: { y: { labelFormatter: (value) => `${(value * 100).toFixed(0)}%` } },
    label: {
      position: 'top',
      style: {
        fill: '#f01010',
        fontSize: 16,
        fontWeight: 600,
        dx: -10,
        dy: -25,
      },
      text: (datum) => {
        const count = datum?.count
        return count !== undefined && count !== null ? `${count}人` : '-'
      },
    },
    scale: { color: { range: ['#52c41a', '#1890ff', '#faad14', '#ff4d4f'] } },
    colorField: 'type',
    tooltip: {
      title: (datum) => datum?.type || '-',
      items: [{ field: 'count', name: '人数', valueFormatter: (value) => `${value}人` }],
    },
  }

  return <Column {...config} height={220} />
}

function buildBarRankConfig(data) {
  return {
    data,
    xField: 'class_name',
    yField: 'avg_score',
    colorField: 'class_name',
    legend: false,
    scale: {
      color: {
        range: ['#4f46e5', '#0891b2', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#2563eb', '#ca8a04'],
      },
    },
    style: {
      radiusTopLeft: 6,
      radiusBottomLeft: 6,
      fillOpacity: (datum) => (datum?.item_type === 'grade_avg' ? 1 : 0.88),
      lineWidth: (datum) => (datum?.item_type === 'grade_avg' ? 3 : 1),
      stroke: (datum) => (datum?.item_type === 'grade_avg' ? '#b45309' : '#ffffff'),
    },
    labels: [
      {
        position: 'right',
        text: (datum) => {
          const prefix = datum?.item_type === 'grade_avg' ? '年级均分 ' : ''
          return `${prefix}${datum?.avg_score?.toFixed(2) ?? '-'}`
        },
        style: {
          fill: (datum) => (datum?.item_type === 'grade_avg' ? '#b45309' : '#1f2937'),
          fontWeight: (datum) => (datum?.item_type === 'grade_avg' ? 800 : 600),
          dx: 16,
        },
      },
    ],
    axis: { y: { labelAutoRotate: false } },
    tooltip: {
      title: (datum) => datum.class_name,
      items: [
        {
          field: 'avg_score',
          name: '图中分值',
          valueFormatter: (value) => Number(value).toFixed(2),
        },
        {
          field: 'grade_avg',
          name: '所属年级均分',
          valueFormatter: (value) => Number(value).toFixed(2),
        },
      ],
    },
  }
}

export default function ClassAnalysis({ examId }) {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classId, setClassId] = useState(null)
  const [loading, setLoading] = useState(false)

  const [subjectRankData, setSubjectRankData] = useState([])
  const [totalRankData, setTotalRankData] = useState([])
  const [threeRateRankData, setThreeRateRankData] = useState([])
  const [distribution, setDistribution] = useState(null)
  const [bottomStudents, setBottomStudents] = useState([])
  const [biasedStudents, setBiasedStudents] = useState([])

  const [selectedSubjectDist, setSelectedSubjectDist] = useState('total')
  const [selectedRankSubjectId, setSelectedRankSubjectId] = useState(null)
  const [selectedThreeRateSubjectId, setSelectedThreeRateSubjectId] = useState(null)

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data || [])).catch(() => setClasses([]))
    getSubjects()
      .then((res) => {
        const subjectList = res.data || []
        setSubjects(subjectList)
        if (!selectedRankSubjectId && subjectList.length > 0) setSelectedRankSubjectId(subjectList[0].id)
        if (!selectedThreeRateSubjectId && subjectList.length > 0) setSelectedThreeRateSubjectId(subjectList[0].id)
      })
      .catch(() => setSubjects([]))
  }, [])

  useEffect(() => {
    if (!examId) {
      setTotalRankData([])
      return
    }
    getClassesRank(examId, undefined)
      .then((res) => setTotalRankData(buildRankChartRowsWithGradeAverage(res.data || [])))
      .catch(() => setTotalRankData([]))
  }, [examId])

  useEffect(() => {
    if (!examId || !selectedRankSubjectId) {
      setSubjectRankData([])
      return
    }
    getClassesRank(examId, selectedRankSubjectId)
      .then((res) => setSubjectRankData(buildRankChartRowsWithGradeAverage(res.data || [])))
      .catch(() => setSubjectRankData([]))
  }, [examId, selectedRankSubjectId])

  useEffect(() => {
    if (!examId || !selectedThreeRateSubjectId) {
      setThreeRateRankData([])
      return
    }
    getExamSubjectThreeRatesOneScoreRank(examId, selectedThreeRateSubjectId)
      .then((res) => {
        const data = (res.data || []).sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
        setThreeRateRankData(data)
      })
      .catch(() => setThreeRateRankData([]))
  }, [examId, selectedThreeRateSubjectId])

  useEffect(() => {
    if (!classId || !examId) {
      setDistribution(null)
      setBottomStudents([])
      setBiasedStudents([])
      return
    }

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
      .catch(() => {
        setDistribution(null)
        setBottomStudents([])
        setBiasedStudents([])
      })
      .finally(() => setLoading(false))
  }, [classId, examId])

  const subjectRankConfig = buildBarRankConfig(subjectRankData)
  const totalRankConfig = buildBarRankConfig(totalRankData)

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
    render: (value, record) => {
      const isWeak = record.weak_subjects?.includes(name) || record.weak_subject === name
      return (
        <span style={{ color: isWeak ? '#ff4d4f' : undefined, fontWeight: isWeak ? 600 : undefined }}>
          {value ?? '-'}
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
      render: (value) => value?.map((item) => <Tag color="red" key={item}>{item}</Tag>),
    },
  ]

  const biasedColumns = [
    { title: '学号', dataIndex: 'student_no', key: 'student_no', width: 100 },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name', width: 80 },
    { title: '偏科科目数', dataIndex: 'weak_count', key: 'weak_count', width: 100 },
    ...subjectCols,
    {
      title: '偏科科目',
      dataIndex: 'weak_subjects',
      key: 'weak_subjects',
      render: (value) => value?.map((item) => <Tag color="orange" key={item}>{item}</Tag>),
    },
  ]

  const threeRateColumns = [
    { title: '班级', dataIndex: 'class_name', key: 'class_name', width: 140 },
    {
      title: '优秀率分数',
      dataIndex: 'excellent_rate_score',
      key: 'excellent_rate_score',
      width: 120,
      render: (value) => Number(value ?? 0).toFixed(2),
    },
    {
      title: '良好率分数',
      dataIndex: 'good_rate_score',
      key: 'good_rate_score',
      width: 120,
      render: (value) => Number(value ?? 0).toFixed(2),
    },
    {
      title: '及格率分数',
      dataIndex: 'pass_rate_score',
      key: 'pass_rate_score',
      width: 120,
      render: (value) => Number(value ?? 0).toFixed(2),
    },
    {
      title: '平均分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 110,
      render: (value) => Number(value ?? 0).toFixed(2),
    },
    {
      title: '总分数',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 110,
      render: (value) => Number(value ?? 0).toFixed(2),
    },
  ]

  const distSubjectOptions = distribution
    ? [
        { value: 'total', label: '总分' },
        ...Object.keys(distribution.subjects || {}).map((name) => ({ value: name, label: name })),
      ]
    : [{ value: 'total', label: '总分' }]

  const currentDistData = selectedSubjectDist === 'total'
    ? distribution?.total
    : distribution?.subjects?.[selectedSubjectDist]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text>选择班级（深度分析）：</Text>
          <Select
            allowClear
            placeholder="不选则仅显示排名"
            style={{ width: 180 }}
            value={classId}
            onChange={setClassId}
            options={classes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Col>
      </Row>

      {!examId ? (
        <Empty description="请先在成绩列表中选择考试" />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card
                title="科目平均分排名"
                size="small"
                extra={(
                  <Select
                    size="small"
                    style={{ width: 160 }}
                    value={selectedRankSubjectId}
                    onChange={setSelectedRankSubjectId}
                    options={subjects.map((item) => ({ value: item.id, label: item.name }))}
                    placeholder="选择科目"
                  />
                )}
              >
                {selectedRankSubjectId && subjectRankData.length > 0 ? (
                  <Bar {...subjectRankConfig} height={300} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="班级平均分排名" size="small">
                {totalRankData.length > 0 ? (
                  <Bar {...totalRankConfig} height={300} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card
                title="三率一分排名"
                size="small"
                extra={(
                  <Select
                    size="small"
                    style={{ width: 160 }}
                    value={selectedThreeRateSubjectId}
                    onChange={setSelectedThreeRateSubjectId}
                    options={subjects.map((item) => ({ value: item.id, label: item.name }))}
                    placeholder="选择科目"
                  />
                )}
              >
                <Table
                  dataSource={threeRateRankData}
                  columns={threeRateColumns}
                  rowKey="class_id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: '暂无数据' }}
                />
              </Card>
            </Col>
          </Row>

          {classId && (
            <>
              <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
                <Text type="secondary" style={{ fontSize: 16, fontWeight: 600 }}>
                  以下为所选班级的深度分析
                </Text>
              </Divider>

              <Spin spinning={loading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card
                      title="成绩分布"
                      size="small"
                      extra={(
                        <Select
                          size="small"
                          style={{ width: 100 }}
                          value={selectedSubjectDist}
                          onChange={setSelectedSubjectDist}
                          options={distSubjectOptions}
                        />
                      )}
                    >
                      <DistributionChart data={currentDistData} />
                    </Card>
                  </Col>

                  <Col xs={24}>
                    <Card
                      title={(
                        <span>
                          偏科生分析{' '}
                          <Tooltip title="仅统计班级总分排名前 40 名的同学。若某同学任意科目成绩低于本班本次考试该科平均分，则视为偏科生。">
                            <QuestionCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
                          </Tooltip>
                        </span>
                      )}
                      size="small"
                    >
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
                </Row>
              </Spin>
            </>
          )}
        </>
      )}
    </div>
  )
}

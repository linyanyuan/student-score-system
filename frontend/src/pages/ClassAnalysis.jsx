import { useEffect, useMemo, useState } from 'react'
import { Alert, Row, Col, Card, Select, Table, Tag, Spin, Empty, Typography, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { Column } from '@ant-design/charts'
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

function buildDistributionSegments(data) {
  const excellentCount = Number(data?.excellent_count || 0)
  const goodCount = Number(data?.good_count || 0)
  const passCount = Number(data?.pass_count || 0)
  const failCount = Number(data?.fail_count ?? 0)
  const totalCount = Number(data?.total_count || 0)
  return [
    { type: '优秀段', count: excellentCount },
    { type: '良好段', count: Math.max(goodCount - excellentCount, 0) },
    { type: '及格段', count: Math.max(passCount - goodCount, 0) },
    { type: '未及格', count: failCount || Math.max(totalCount - passCount, 0) },
  ]
}

function DistributionChart({ data }) {
  if (!data || Number(data.total_count || 0) <= 0) {
    return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  const rateChartData = [
    { type: '优秀率(≥80%)', rateName: '优秀率', value: data.excellent_rate || 0, count: data.excellent_count || 0 },
    { type: '良好率(≥70%)', rateName: '良好率', value: data.good_rate || 0, count: data.good_count || 0 },
    { type: '及格率(≥60%)', rateName: '及格率', value: data.pass_rate || 0, count: data.pass_count || 0 },
    { type: '低分率(≤30%)', rateName: '低分率', value: data.low_rate || 0, count: data.low_count || 0 },
  ]
  const segmentData = buildDistributionSegments(data)
  const totalCount = Number(data.total_count || 0)
  const segmentColors = {
    优秀段: '#52c41a',
    良好段: '#1890ff',
    及格段: '#faad14',
    未及格: '#ff4d4f',
  }

  const columnConfig = {
    data: rateChartData,
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
        const value = Number(datum?.value ?? 0)
        return `${(value * 100).toFixed(2)}%`
      },
    },
    scale: { color: { range: ['#52c41a', '#1890ff', '#faad14', '#ff4d4f'] } },
    colorField: 'type',
    tooltip: {
      title: (datum) => datum?.type || '-',
      items: [
        (datum) => ({
          name: datum?.rateName || '率',
          value: `${(Number(datum?.value || 0) * 100).toFixed(2)}%`,
        }),
        { field: 'count', name: '人数', valueFormatter: (value) => `${value}人` },
      ],
    },
  }

  return (
    <div className="class-analysis-distribution-grid">
      <div className="class-analysis-distribution-pane">
        <div className="class-analysis-chart-subtitle">四率柱状图</div>
        <span className="class-analysis-rate-label" aria-hidden="true" />
        <Column {...columnConfig} height={240} />
      </div>
      <div className="class-analysis-distribution-pane">
        <div className="class-analysis-chart-subtitle">人数占比</div>
        <div className="class-analysis-segment-bar" aria-label="人数占比">
          {segmentData.map((item) => {
            const percent = totalCount > 0 ? item.count / totalCount : 0
            return (
              <div
                className="class-analysis-segment-bar-part"
                key={item.type}
                style={{ width: `${percent * 100}%`, background: segmentColors[item.type] }}
                title={`${item.type} ${item.count}人 ${(percent * 100).toFixed(2)}%`}
              />
            )
          })}
        </div>
        <div className="class-analysis-segment-cards">
          {segmentData.map((item) => {
            const percent = totalCount > 0 ? item.count / totalCount : 0
            return (
              <div className="class-analysis-segment-card" key={item.type}>
                <span className="class-analysis-segment-dot" style={{ background: segmentColors[item.type] }} />
                <span className="class-analysis-segment-name">{item.type}</span>
                <strong>{item.count}人</strong>
                <small>{(percent * 100).toFixed(2)}%</small>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RankListChart({ data }) {
  const maxScore = Math.max(...data.map((item) => Number(item?.avg_score || 0)), 1)
  let classRank = 0

  return (
    <div className="class-analysis-rank-chart">
      {data.map((item) => {
        const score = Number(item?.avg_score || 0)
        const isGradeAverage = item?.item_type === 'grade_avg'
        const width = Math.max((score / maxScore) * 100, 4)
        if (!isGradeAverage) classRank += 1

        return (
          <div
            className={`class-analysis-rank-row${isGradeAverage ? ' is-grade-average' : ''}`}
            key={`${item?.class_name}-${item?.item_type || 'class'}`}
            title={`${item?.class_name || '-'} ${isGradeAverage ? '年级均分' : '平均分'} ${score.toFixed(2)}`}
          >
            <div className="class-analysis-rank-meta">
              <span className="class-analysis-rank-index">{isGradeAverage ? '均' : classRank}</span>
              <span className="class-analysis-rank-name">{item?.class_name || '-'}</span>
            </div>
            <div className="class-analysis-rank-track" aria-hidden="true">
              <span className="class-analysis-rank-fill" style={{ width: `${width}%` }} />
            </div>
            <div className="class-analysis-rank-value">
              {isGradeAverage && <span>年级均分</span>}
              <strong>{score.toFixed(2)}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ClassAnalysis({ examId, examGrades = [] }) {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedGrade, setSelectedGrade] = useState(null)
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
    getClasses({ scope: 'analysis' }).then((res) => setClasses(res.data || [])).catch(() => setClasses([]))
    getSubjects()
      .then((res) => {
        const subjectList = res.data || []
        setSubjects(subjectList)
        if (!selectedRankSubjectId && subjectList.length > 0) setSelectedRankSubjectId(subjectList[0].id)
        if (!selectedThreeRateSubjectId && subjectList.length > 0) setSelectedThreeRateSubjectId(subjectList[0].id)
      })
      .catch(() => setSubjects([]))
  }, [])

  const examScopedClasses = useMemo(() => {
    const allowedGrades = new Set(examGrades.filter(Boolean))
    return allowedGrades.size > 0
      ? classes.filter((item) => allowedGrades.has(item.grade))
      : classes
  }, [classes, examGrades])

  const gradeOptions = useMemo(
    () => Array.from(new Set(examScopedClasses.map((item) => item.grade).filter(Boolean))),
    [examScopedClasses],
  )

  const filteredClasses = useMemo(
    () => examScopedClasses.filter((item) => !selectedGrade || item.grade === selectedGrade),
    [examScopedClasses, selectedGrade],
  )

  const gradeSelectionRequired = examId && gradeOptions.length > 1 && !selectedGrade
  const canRenderGradeScopedContent = Boolean(examId) && !gradeSelectionRequired

  useEffect(() => {
    if (!examId) {
      setSelectedGrade(null)
      return
    }
    if (gradeOptions.length === 1) {
      setSelectedGrade(gradeOptions[0])
      return
    }
    if (selectedGrade && gradeOptions.includes(selectedGrade)) return
    setSelectedGrade(null)
  }, [examId, gradeOptions, selectedGrade])

  useEffect(() => {
    if (!classId) return
    if (filteredClasses.some((item) => item.id === classId)) return
    setClassId(null)
  }, [classId, filteredClasses])

  useEffect(() => {
    if (!examId) {
      setTotalRankData([])
      return
    }
    if (!canRenderGradeScopedContent) {
      setTotalRankData([])
      return
    }
    getClassesRank(examId, undefined)
      .then((res) => {
        const rows = (res.data || []).filter((item) => !selectedGrade || item.grade === selectedGrade)
        setTotalRankData(buildRankChartRowsWithGradeAverage(rows))
      })
      .catch(() => setTotalRankData([]))
  }, [canRenderGradeScopedContent, examId, selectedGrade])

  useEffect(() => {
    if (!examId || !selectedRankSubjectId) {
      setSubjectRankData([])
      return
    }
    if (!canRenderGradeScopedContent) {
      setSubjectRankData([])
      return
    }
    getClassesRank(examId, selectedRankSubjectId)
      .then((res) => {
        const rows = (res.data || []).filter((item) => !selectedGrade || item.grade === selectedGrade)
        setSubjectRankData(buildRankChartRowsWithGradeAverage(rows))
      })
      .catch(() => setSubjectRankData([]))
  }, [canRenderGradeScopedContent, examId, selectedGrade, selectedRankSubjectId])

  useEffect(() => {
    if (!examId || !selectedThreeRateSubjectId) {
      setThreeRateRankData([])
      return
    }
    if (!canRenderGradeScopedContent) {
      setThreeRateRankData([])
      return
    }
    getExamSubjectThreeRatesOneScoreRank(examId, selectedThreeRateSubjectId)
      .then((res) => {
        const data = (res.data || [])
          .filter((item) => !selectedGrade || item.grade === selectedGrade)
          .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
        setThreeRateRankData(data)
      })
      .catch(() => setThreeRateRankData([]))
  }, [canRenderGradeScopedContent, examId, selectedGrade, selectedThreeRateSubjectId])

  useEffect(() => {
    if (!classId || !examId || !canRenderGradeScopedContent) {
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
  }, [canRenderGradeScopedContent, classId, examId])

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
      title: '低分率得分',
      dataIndex: 'low_rate_score',
      key: 'low_rate_score',
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
    <div className="class-analysis-page">
      {!examId ? (
        <Empty description="请先在成绩列表中选择考试" />
      ) : (
        <>
          <div className="class-analysis-grade-pivot" style={{ marginBottom: 16 }}>
            <div className="class-analysis-deep-copy">
              <span className="class-analysis-deep-kicker">分析范围</span>
              <Text className="class-analysis-deep-title">先按年级查看，再进入班级深度分析</Text>
            </div>
            <div className="class-analysis-deep-control">
              <Text className="class-analysis-picker-label">选择年级</Text>
              <Select
                allowClear={gradeOptions.length > 1}
                placeholder={gradeOptions.length > 1 ? '请选择年级' : '系统自动匹配年级'}
                className="class-analysis-picker"
                value={selectedGrade}
                onChange={setSelectedGrade}
                options={gradeOptions.map((grade) => ({ value: grade, label: grade }))}
                disabled={gradeOptions.length <= 1}
              />
            </div>
          </div>

          {gradeSelectionRequired && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="请选择年级查看班级分析"
              description="当前考试覆盖多个年级。先选择年级后，再查看平均分排名、四率一分和班级深度分析。"
            />
          )}

          <Row gutter={16} className="class-analysis-rank-grid">
            <Col xs={24} lg={12}>
              <Card
                className="class-analysis-panel-card class-analysis-chart-card"
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
                {canRenderGradeScopedContent && selectedRankSubjectId && subjectRankData.length > 0 ? (
                  <RankListChart data={subjectRankData} />
                ) : (
                  <Empty
                    description={gradeSelectionRequired ? '请选择年级查看班级分析' : '暂无数据'}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card className="class-analysis-panel-card class-analysis-chart-card" title="班级平均分排名" size="small">
                {canRenderGradeScopedContent && totalRankData.length > 0 ? (
                  <RankListChart data={totalRankData} />
                ) : (
                  <Empty
                    description={gradeSelectionRequired ? '请选择年级查看班级分析' : '暂无数据'}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card
                className="class-analysis-panel-card class-analysis-table-card"
                title="四率一分排名"
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
                  dataSource={canRenderGradeScopedContent ? threeRateRankData : []}
                  columns={threeRateColumns}
                  rowKey="class_id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: gradeSelectionRequired ? '请选择年级查看班级分析' : '暂无数据' }}
                />
              </Card>
            </Col>
          </Row>

          <div className="class-analysis-deep-pivot">
            <div className="class-analysis-deep-copy">
              <span className="class-analysis-deep-kicker">班级深度分析</span>
              <Text className="class-analysis-deep-title">以下为所选班级的深度分析</Text>
            </div>
            <div className="class-analysis-deep-control">
              <Text className="class-analysis-picker-label">选择班级</Text>
              <Select
                allowClear
                placeholder="不选则仅显示排名"
                className="class-analysis-picker"
                value={classId}
                onChange={setClassId}
                options={filteredClasses.map((item) => ({ value: item.id, label: item.name }))}
                disabled={gradeSelectionRequired}
              />
            </div>
          </div>

          {canRenderGradeScopedContent && classId && (
            <>
              <Spin spinning={loading}>
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card
                      className="class-analysis-panel-card class-analysis-chart-card"
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
                      className="class-analysis-panel-card class-analysis-table-card"
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
                    <Card className="class-analysis-panel-card class-analysis-table-card" title="后进生分析（总分排名靠后）" size="small">
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
          {(!canRenderGradeScopedContent || !classId) && (
            <div className="class-analysis-empty-prompt">
              <Empty
                description={gradeSelectionRequired ? '请选择年级查看班级分析' : '请选择班级查看深度分析'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

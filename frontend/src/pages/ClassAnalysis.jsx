import { useState, useEffect } from 'react'
import { Row, Col, Card, Select, Table, Tag, Spin, Empty, Typography, Tooltip, Checkbox } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { Column, Bar } from '@ant-design/charts'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import {
  getClassesRank,
  getClassDistribution,
  getClassBottomStudents,
  getClassBiasedStudents,
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
    axis: { y: { labelFormatter: (v) => `${(v * 100).toFixed(0)}%` } },
    label: {
      position: 'top',
      text: (datum) => {
        const count = datum?.count
        return count !== undefined && count !== null ? `${count}人` : '-'
      },
    },
    scale: { color: { range: ['#52c41a', '#1890ff', '#faad14', '#ff4d4f'] } },
    colorField: 'type',
    tooltip: {
      title: (d) => d?.type || '-',
      items: [{ field: 'count', name: '人数', valueFormatter: (v) => `${v}人` }],
    },
  }
  return <Column {...config} height={220} />
}

export default function ClassAnalysis({ examId }) {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classId, setClassId] = useState(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [loading, setLoading] = useState(false)

  const [classesRankData, setClassesRankData] = useState([])
  const [totalRankData, setTotalRankData] = useState([])
  const [distribution, setDistribution] = useState(null)
  const [bottomStudents, setBottomStudents] = useState([])
  const [biasedStudents, setBiasedStudents] = useState([])
  const [selectedSubjectDist, setSelectedSubjectDist] = useState('total')

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data || []))
    getSubjects().then((res) => setSubjects(res.data || []))
  }, [])

  // Fetch total score rank (always shown on right)
  useEffect(() => {
    if (!examId) {
      setTotalRankData([])
      return
    }
    getClassesRank(examId, undefined).then((res) => {
      const data = (res.data || []).sort((a, b) => b.avg_score - a.avg_score)
      setTotalRankData(data)
    })
  }, [examId])

  // Fetch subject rank when examId or selectedSubjectIds changes
  useEffect(() => {
    if (!examId || selectedSubjectIds.length === 0) {
      setClassesRankData([])
      return
    }
    Promise.all(
      selectedSubjectIds.map((subjectId) =>
        getClassesRank(examId, subjectId).then((res) => {
          const subjectName = subjects.find((s) => s.id === subjectId)?.name || '未知科目'
          return (res.data || []).map((item) => ({
            ...item,
            subject_name: subjectName,
            subject_id: subjectId,
          }))
        })
      )
    ).then((results) => {
      setClassesRankData(results.flat())
    })
  }, [examId, selectedSubjectIds, subjects])

  // Fetch single-class analysis when classId or examId changes
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

  // Subject rank chart config - x轴为科目，不同班级作为分组
  const rankConfig = {
    data: classesRankData,
    xField: 'subject_name',
    yField: 'avg_score',
    seriesField: 'class_name',
    isGroup: true,
    labels:[
      { text: (datum) => {
        const score = datum?.avg_score
        return score !== undefined && score !== null ? score.toFixed(2) : '-'
      }, style: {
         fill: '#f01010',
        fontWeight: 600, dy: -18 } },],
    colorField: 'class_name',
    axis: { x: { labelAutoRotate: true } },
    tooltip: {
      title: (d) => d?.subject_name || '-',
      items: [{ field: 'avg_score', name: (d) => d?.class_name || '-', valueFormatter: (v) => Number(v).toFixed(2) }],
    },
    legend: { position: 'top' },
  }

  // Total rank chart config - 横向条形图排行榜
  const totalRankConfig = {
    data: totalRankData,
    xField: 'class_name',
    yField: 'avg_score',
    legend: false,
    colorField: 'class_name',
    labels:[{
      position: 'right',
      text: (datum) => datum?.avg_score?.toFixed(2) ?? '-',
      style: {
         fill: '#f01010',
        fontWeight: 600,dx:50} 
    },],
    axis: { y: false, y: { labelAutoRotate: false } },
    tooltip: {
      title: (d) => d.class_name,
      items: [{ field: 'avg_score', name: '平均分', valueFormatter: (v) => Number(v).toFixed(2) }],
    },
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
    { title: '偏科科目数', dataIndex: 'weak_count', key: 'weak_count', width: 100 },
    ...subjectCols,
    {
      title: '偏科科目',
      dataIndex: 'weak_subjects',
      key: 'weak_subjects',
      render: (val) => val?.map((s) => <Tag color="orange" key={s}>{s}</Tag>),
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
          {/* Class rank charts - left: subject rank, right: total rank */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card
                title="科目排名"
                size="small"
                extra={
                  <Checkbox.Group
                    value={selectedSubjectIds}
                    onChange={setSelectedSubjectIds}
                    options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                  />
                }
              >
                {selectedSubjectIds.length > 0 && classesRankData.length > 0 ? (
                  <Column {...rankConfig} height={260} />
                ) : (
                  <Empty description="请勾选科目查看排名" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="班级平均分排名" size="small">
                {totalRankData.length > 0 ? (
                  <Bar {...totalRankConfig} height={260} />
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

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
                  <Card
                    title={
                      <span>
                        偏科生分析{' '}
                        <Tooltip title="仅统计班级总分排名前 40 名的同学。若某同学任意科目成绩低于本班本次考试该科平均分，则视为偏科生。">
                          <QuestionCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }
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
              </Row>
            </Spin>
          )}
        </>
      )}
    </div>
  )
}

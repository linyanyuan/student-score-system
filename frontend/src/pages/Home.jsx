import { useState, useEffect } from 'react'
import { Typography, Card, Row, Col, Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, message, Checkbox, TimePicker } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { getDailyQuote, getMySchedule, getMemos, createMemo, updateMemo, deleteMemo, updateMemoStatus, getSchedulePeriods, createSchedulePeriod, createOrUpdateSchedule, deleteSchedule, updateSchedulePeriod } from '../api/schedule'
import { getClasses } from '../api/class'
import { getSubjects } from '../api/subject'
import dayjs from 'dayjs'
import { buildSchedulePeriodPayload, isCreatingFirstPeriod } from './homePeriodUtils'

const { Title, Paragraph } = Typography
const { TextArea } = Input

export default function Home() {
  const { user } = useAuth()
  const [quote, setQuote] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [periods, setPeriods] = useState([])
  const [memos, setMemos] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [memoModalVisible, setMemoModalVisible] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [periodModalVisible, setPeriodModalVisible] = useState(false)
  const [editingMemo, setEditingMemo] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [memoForm] = Form.useForm()
  const [scheduleForm] = Form.useForm()
  const [periodForm] = Form.useForm()

  const roleLabel = user?.role === 'admin' ? '管理员' : user?.role === 'school_admin' ? '学校管理员' : user?.role === 'teacher' ? '教师' : '学生'
  const showScheduleSection = ['school_admin', 'teacher', 'student'].includes(user?.role)
  const canLoadScheduleEditorMeta = user?.role === 'teacher'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    // 加载每日语句
    try {
      const quoteRes = await getDailyQuote()
      setQuote(quoteRes.data)
    } catch (error) {
      console.error('加载每日语句失败:', error)
    }

    // 加载备忘录 - 所有角色
    try {
      const memosRes = await getMemos({ status: 'pending', limit: 5 })
      setMemos(memosRes.data)
    } catch (error) {
      console.error('加载备忘录失败:', error)
    }
    if (showScheduleSection) {
      // 加载课表
      try {
        const scheduleRes = await getMySchedule()
        setSchedule(scheduleRes.data)
      } catch (error) {
        console.error('加载课表失败:', error)
      }

      // 加载节次
      try {
        const periodsRes = await getSchedulePeriods()
        setPeriods(periodsRes.data)
      } catch (error) {
        console.error('加载节次失败:', error)
      }
    }

    if (canLoadScheduleEditorMeta) {
      // 加载班级和科目
      try {
        const classesRes = await getClasses()
        setClasses(classesRes.data)
      } catch (error) {
        console.error('加载班级失败:', error)
      }

      try {
        const subjectsRes = await getSubjects()
        setSubjects(subjectsRes.data)
      } catch (error) {
        console.error('加载科目失败:', error)
      }
    }
  }

  const handleCreateMemo = () => {
    setEditingMemo(null)
    memoForm.resetFields()
    setMemoModalVisible(true)
  }

  const handleEditMemo = (memo) => {
    setEditingMemo(memo)
    memoForm.setFieldsValue({
      ...memo,
      due_date: memo.due_date ? dayjs(memo.due_date) : null
    })
    setMemoModalVisible(true)
  }

  const handleMemoSubmit = async () => {
    try {
      const values = await memoForm.validateFields()
      const data = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      }

      if (editingMemo) {
        await updateMemo(editingMemo.id, data)
        message.success('更新成功')
      } else {
        await createMemo(data)
        message.success('创建成功')
      }

      setMemoModalVisible(false)
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDeleteMemo = async (id) => {
    try {
      await deleteMemo(id)
      message.success('删除成功')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleToggleMemoStatus = async (memo) => {
    try {
      const newStatus = memo.status === 'pending' ? 'completed' : 'pending'
      await updateMemoStatus(memo.id, newStatus)
      message.success('状态更新成功')
      loadData()
    } catch (error) {
      message.error('状态更新失败')
    }
  }

  const handleEditSchedule = (periodId, weekday) => {
    const existing = schedule.find(s => s.period_id === periodId && s.weekday === weekday)
    setEditingSchedule({ periodId, weekday, existing })
    scheduleForm.setFieldsValue({
      class_id: existing?.class_id,
      subject_id: existing?.subject_id
    })
    setScheduleModalVisible(true)
  }

  const handleScheduleSubmit = async () => {
    try {
      const values = await scheduleForm.validateFields()
      await createOrUpdateSchedule({
        period_id: editingSchedule.periodId,
        weekday: editingSchedule.weekday,
        class_id: values.class_id || null,
        subject_id: values.subject_id || null
      })
      message.success('保存成功')
      setScheduleModalVisible(false)
      loadData()
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteSchedule(id)
      message.success('删除成功')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleEditPeriod = (period) => {
    setEditingPeriod(period)
    periodForm.setFieldsValue({
      name: period.name,
      start_time: dayjs(period.start_time, 'HH:mm'),
      end_time: dayjs(period.end_time, 'HH:mm')
    })
    setPeriodModalVisible(true)
  }

  const handleManagePeriods = () => {
    if (periods.length > 0) {
      handleEditPeriod(periods[0])
      return
    }
    setEditingPeriod(null)
    periodForm.resetFields()
    periodForm.setFieldsValue({ sort_order: 1 })
    setPeriodModalVisible(true)
  }

  const handlePeriodSubmit = async () => {
    try {
      const values = await periodForm.validateFields()

      if (isCreatingFirstPeriod(periods, editingPeriod)) {
        await createSchedulePeriod(buildSchedulePeriodPayload(values))
        message.success('Created successfully')
        setPeriodModalVisible(false)
        setEditingPeriod(null)
        periodForm.resetFields()
        await loadData()
        return
      }

      const newStartTime = values.start_time.format('HH:mm')
      const oldStartTime = editingPeriod.start_time

      const oldStart = dayjs(oldStartTime, 'HH:mm')
      const newStart = dayjs(newStartTime, 'HH:mm')
      const timeDiff = newStart.diff(oldStart, 'minute')

      if (timeDiff !== 0) {
        Modal.confirm({
          title: 'Adjust later periods?',
          content: `Time changed by ${Math.abs(timeDiff)} minutes. Sync later periods as well?`,
          okText: 'Yes',
          cancelText: 'No',
          onOk: async () => {
            await updatePeriodWithAdjustment(editingPeriod.id, values, timeDiff, true)
          },
          onCancel: async () => {
            await updatePeriodWithAdjustment(editingPeriod.id, values, timeDiff, false)
          }
        })
      } else {
        await updatePeriodWithAdjustment(editingPeriod.id, values, 0, false)
      }
    } catch (error) {
      message.error('Operation failed')
    }
  }

  const updatePeriodWithAdjustment = async (periodId, values, timeDiff, adjustOthers) => {
    try {
      const data = {
        name: values.name,
        start_time: values.start_time.format('HH:mm'),
        end_time: values.end_time.format('HH:mm')
      }

      await updateSchedulePeriod(periodId, data)

      // 如果需要调整其他节次
      if (adjustOthers && timeDiff !== 0) {
        const currentIndex = periods.findIndex(p => p.id === periodId)
        const laterPeriods = periods.slice(currentIndex + 1)

        for (const period of laterPeriods) {
          const oldStart = dayjs(period.start_time, 'HH:mm')
          const oldEnd = dayjs(period.end_time, 'HH:mm')
          const newStart = oldStart.add(timeDiff, 'minute')
          const newEnd = oldEnd.add(timeDiff, 'minute')

          await updateSchedulePeriod(period.id, {
            start_time: newStart.format('HH:mm'),
            end_time: newEnd.format('HH:mm')
          })
        }
      }

      message.success('更新成功')
      setPeriodModalVisible(false)
      loadData()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const isCreatingFirstPeriodMode = isCreatingFirstPeriod(periods, editingPeriod)

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red'
      case 'medium': return 'orange'
      case 'low': return 'green'
      default: return 'default'
    }
  }

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return '高'
      case 'medium': return '中'
      case 'low': return '低'
      default: return priority
    }
  }

  // 构建课表数据结构
  const scheduleTable = periods.map(period => {
    const row = { period: period.name, time: `${period.start_time}-${period.end_time}` }
    for (let day = 1; day <= 5; day++) {
      const item = schedule.find(s => s.period_id === period.id && s.weekday === day)
      row[`day${day}`] = item
    }
    return row
  })

  const scheduleColumns = [
    { title: '节次', dataIndex: 'period', key: 'period', width: 100 },
    { title: '时间', dataIndex: 'time', key: 'time', width: 120 },
    ...['周一', '周二', '周三', '周四', '周五'].map((day, index) => ({
      title: day,
      dataIndex: `day${index + 1}`,
      key: `day${index + 1}`,
      render: (item, record) => {
        const periodId = periods.find(p => p.name === record.period)?.id
        const canEditSchedule = user?.role === 'teacher'
        return (
          <div
            style={{ cursor: canEditSchedule ? 'pointer' : 'default', minHeight: 40, padding: 4 }}
            onClick={() => canEditSchedule && handleEditSchedule(periodId, index + 1)}
          >
            {item ? (
              <div>
                <div>{item.class_name}-{item.subject_name}</div>
                {canEditSchedule && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSchedule(item.id)
                    }}
                  >
                    删除
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ color: '#999' }}>{canEditSchedule ? '点击添加' : ''}</div>
            )}
          </div>
        )
      }
    }))
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 每日语句 */}
      {quote && (
        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Paragraph style={{ fontSize: 18, marginBottom: 8, color: 'white' }}>
            "{quote.content}"
          </Paragraph>
          {quote.source && (
            <Paragraph style={{ textAlign: 'right', marginBottom: 0, color: 'rgba(255,255,255,0.8)' }}>
              — {quote.source}
            </Paragraph>
          )}
        </Card>
      )}

      <Row gutter={24}>
        {/* 课表区域 - 仅 school_admin / teacher / student 可见 */}
        {showScheduleSection && (
          <Col xs={24} lg={14}>
            <Card
              title="本周课表"
              extra={
                user?.role === 'school_admin' && (
                  <Button
                    icon={<SettingOutlined />}
                    onClick={handleManagePeriods}
                  >
                    节次管理
                  </Button>
                )
              }
              style={{ marginBottom: 24 }}
            >
              <Table
                dataSource={scheduleTable}
                columns={scheduleColumns}
                pagination={false}
                size="small"
                rowKey="period"
              />
            </Card>
          </Col>
        )}

        {/* 备忘录区域 - 所有角色可见 */}
        <Col xs={24} lg={showScheduleSection ? 10 : 24}>
          <Card
            title="备忘录"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMemo}>
                新建
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {memos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无待办事项
              </div>
            ) : (
              memos.map(memo => (
                <Card
                  key={memo.id}
                  size="small"
                  style={{ marginBottom: 12 }}
                  actions={[
                    <EditOutlined key="edit" onClick={() => handleEditMemo(memo)} />,
                    <DeleteOutlined key="delete" onClick={() => handleDeleteMemo(memo.id)} />
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <Checkbox
                      checked={memo.status === 'completed'}
                      onChange={() => handleToggleMemoStatus(memo)}
                    />
                    <span style={{ marginLeft: 8, flex: 1, textDecoration: memo.status === 'completed' ? 'line-through' : 'none' }}>
                      {memo.title}
                    </span>
                    <Tag color={getPriorityColor(memo.priority)}>{getPriorityLabel(memo.priority)}</Tag>
                  </div>
                  {memo.description && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{memo.description}</div>
                  )}
                  {memo.due_date && (
                    <div style={{ fontSize: 12, color: dayjs(memo.due_date).isBefore(dayjs()) ? 'red' : '#999' }}>
                      截止: {memo.due_date}
                    </div>
                  )}
                </Card>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* 备忘录编辑弹窗 */}
      <Modal
        title={editingMemo ? '编辑备忘录' : '新建备忘录'}
        open={memoModalVisible}
        onOk={handleMemoSubmit}
        onCancel={() => setMemoModalVisible(false)}
      >
        <Form form={memoForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="如：教学任务、会议等" />
          </Form.Item>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 课表编辑弹窗 */}
      <Modal
        title="编辑课表"
        open={scheduleModalVisible}
        onOk={handleScheduleSubmit}
        onCancel={() => setScheduleModalVisible(false)}
      >
        <Form form={scheduleForm} layout="vertical">
          <Form.Item name="class_id" label="班级">
            <Select allowClear placeholder="选择班级">
              {classes.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="subject_id" label="科目">
            <Select allowClear placeholder="选择科目">
              {subjects.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 节次编辑弹窗 */}
      <Modal
        title={isCreatingFirstPeriodMode ? 'Create First Period' : 'Edit Period Time'}
        open={periodModalVisible}
        onOk={handlePeriodSubmit}
        onCancel={() => setPeriodModalVisible(false)}
        footer={undefined}
        width={600}
      >
        {isCreatingFirstPeriodMode && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4, color: '#ad4e00' }}>
            当前暂无节次数据，请先补充节次信息后再进行编辑。
          </div>
        )}
        <Form form={periodForm} layout="vertical">
          <Form.Item name="name" label="节次名称" rules={[{ required: true, message: '请输入节次名称' }]}>
            <Input disabled={!isCreatingFirstPeriodMode} />
          </Form.Item>
          {isCreatingFirstPeriodMode && (
            <Form.Item name="sort_order" label="Sort Order" initialValue={1} rules={[{ required: true, message: 'Please enter a sort order' }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            提示：修改时间后，系统会询问是否同步调整后续节次的时间
          </p>
        </div>
        {!isCreatingFirstPeriodMode && periods.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 'bold', marginBottom: 8 }}>所有节次：</p>
            {periods.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: editingPeriod?.id === p.id ? '#e6f7ff' : '#fafafa',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
                onClick={() => handleEditPeriod(p)}
              >
                <span>{p.name}</span>
                <span style={{ color: '#666' }}>{p.start_time} - {p.end_time}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

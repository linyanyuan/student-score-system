import { useState, useEffect } from 'react'
import { Select, Table, Button, Space, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getTeacherClasses, createTeacherClass, deleteTeacherClass } from '../api/teacherClass'
import { getClasses } from '../api/class'
import request from '../api/request'

export default function TeacherClassManage() {
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)

  useEffect(() => {
    getClasses().then((res) => setClasses(res.data)).catch(() => {})
    request.get('/api/auth/teachers').then((res) => setTeachers(res.data)).catch(() => {})
    fetchAssignments()
  }, [])

  const fetchAssignments = async (teacherId) => {
    setLoading(true)
    try {
      const res = await getTeacherClasses(teacherId)
      setAssignments(res.data)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTeacher = (teacherId) => {
    setSelectedTeacher(teacherId)
    fetchAssignments(teacherId)
  }

  const handleAdd = async () => {
    if (!selectedTeacher || !selectedClass) {
      message.warning('请先选择教师和班级')
      return
    }
    try {
      await createTeacherClass({ teacher_id: selectedTeacher, class_id: selectedClass })
      message.success('分配成功')
      setSelectedClass(null)
      fetchAssignments(selectedTeacher)
    } catch (err) {
      message.error(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteTeacherClass(id)
      message.success('取消分配成功')
      fetchAssignments(selectedTeacher)
    } catch (err) {
      message.error(err.message)
    }
  }

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]))
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t.username]))

  const columns = [
    { title: '教师', key: 'teacher_name', render: (_, r) => teacherMap[r.teacher_id] || `ID: ${r.teacher_id}` },
    { title: '班级', key: 'class_name', render: (_, r) => classMap[r.class_id] || r.class_id },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, record) => (
        <Popconfirm title="确认取消分配？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" danger>取消</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <span>选择教师：</span>
        <Select
          style={{ width: 200 }}
          placeholder="选择教师"
          allowClear
          showSearch
          optionFilterProp="label"
          onChange={handleSelectTeacher}
          value={selectedTeacher}
          options={teachers.map((t) => ({ label: t.username, value: t.id }))}
        />
        <Select
          style={{ width: 200 }}
          placeholder="选择班级"
          value={selectedClass}
          onChange={setSelectedClass}
          options={classes.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>分配</Button>
      </Space>
      <Table columns={columns} dataSource={assignments} rowKey="id" loading={loading} />
    </>
  )
}

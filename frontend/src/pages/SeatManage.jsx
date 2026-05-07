import { useState, useEffect } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import { Select, Button, Card, Space, Typography, message, Modal } from 'antd'
import { getClasses } from '../api/class'
import { getStudents } from '../api/student'
import { seatApi } from '../api/seats'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography

export default function SeatManage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [view, setView] = useState('teacher') // 'teacher' | 'student'
  const [layoutConfig, setLayoutConfig] = useState({
    columns: 9,
    column_rows: [8, 8, 8, 8, 8 ,8, 8, 8,8],
    podium_position: 'bottom'
  })
  const [seatData, setSeatData] = useState({})
  const [unassignedStudents, setUnassignedStudents] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      loadStudents()
      loadSeatArrangement()
    }
  }, [selectedClass])

  useEffect(() => {
    if (students.length > 0) {
      const assignedIds = Object.values(seatData)
        .filter(seat => seat && seat.student_id)
        .map(seat => seat.student_id)
      setUnassignedStudents(students.filter(s => !assignedIds.includes(s.id)))
    }
  }, [students, seatData])

  const loadClasses = async () => {
    try {
      const res = await getClasses()
      setClasses(res.data)
    } catch {
      message.error('加载班级失败')
    }
  }

  const loadStudents = async () => {
    try {
      const res = await getStudents({ class_id: selectedClass, page_size: 9999 })
      setStudents(res.data.items)
    } catch {
      message.error('加载学生失败')
    }
  }

  const loadSeatArrangement = async () => {
    try {
      const res = await seatApi.getSeatArrangement(selectedClass)
      setLayoutConfig(res.data.layout_config)
      setSeatData(res.data.seat_data)
      setHasUnsavedChanges(false)
    } catch (error) {
      if (error.response?.status === 404) {
        setLayoutConfig({ columns: 5, column_rows: [6, 6, 6, 6, 6], podium_position: 'bottom' })
        setSeatData({})
        setHasUnsavedChanges(false)
      }
    }
  }

  const handleSave = async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      await seatApi.saveSeatArrangement(selectedClass, { layout_config: layoutConfig, seat_data: seatData })
      setHasUnsavedChanges(false)
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (!selectedClass) return
    Modal.confirm({
      title: '确定要重置座位表吗？',
      onOk: async () => {
        try {
          await seatApi.deleteSeatArrangement(selectedClass)
          setSeatData({})
          setHasUnsavedChanges(false)
          message.success('重置成功')
        } catch (error) {
          message.error('重置失败: ' + (error.response?.data?.detail || error.message))
        }
      }
    })
  }

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current
    const newSeatData = { ...seatData }

    if (activeData.type === 'unassigned' && overData.type === 'seat') {
      const targetPos = overData.position
      if (newSeatData[targetPos]?.student_id) {
        setUnassignedStudents(prev => [...prev, students.find(s => s.id === newSeatData[targetPos].student_id)])
      }
      newSeatData[targetPos] = { student_id: activeData.student.id }
      setSeatData(newSeatData)
      setHasUnsavedChanges(true)
    }

    if (activeData.type === 'seat' && overData.type === 'seat') {
      const sourcePos = activeData.position
      const targetPos = overData.position
      const temp = newSeatData[sourcePos]
      newSeatData[sourcePos] = newSeatData[targetPos] || null
      newSeatData[targetPos] = temp
      setSeatData(newSeatData)
      setHasUnsavedChanges(true)
    }

    if (activeData.type === 'seat' && overData.type === 'unassigned') {
      const sourcePos = activeData.position
      if (newSeatData[sourcePos]?.student_id) {
        setUnassignedStudents(prev => [...prev, students.find(s => s.id === newSeatData[sourcePos].student_id)])
        newSeatData[sourcePos] = null
        setSeatData(newSeatData)
        setHasUnsavedChanges(true)
      }
    }
  }

  const handleColumnCountChange = (delta) => {
    const newColumns = Math.max(1, Math.min(10, layoutConfig.columns + delta))
    if (newColumns === layoutConfig.columns) return

    if (newColumns < layoutConfig.columns) {
      const removedStudents = []
      const newSeatData = { ...seatData }
      for (let col = newColumns; col < layoutConfig.columns; col++) {
        for (let row = 0; row < layoutConfig.column_rows[col]; row++) {
          const key = `${col}-${row}`
          if (newSeatData[key]?.student_id) {
            removedStudents.push(students.find(s => s.id === newSeatData[key].student_id))
            delete newSeatData[key]
          }
        }
      }
      if (removedStudents.length > 0) {
        Modal.confirm({
          title: `第${newColumns + 1}列及之后有${removedStudents.length}名学生，删除后将返回未分配列表，确认吗？`,
          onOk: () => {
            setUnassignedStudents(prev => [...prev, ...removedStudents])
            setSeatData(newSeatData)
            setLayoutConfig({ ...layoutConfig, columns: newColumns, column_rows: layoutConfig.column_rows.slice(0, newColumns) })
            setHasUnsavedChanges(true)
          }
        })
        return
      }
      setLayoutConfig({ ...layoutConfig, columns: newColumns, column_rows: layoutConfig.column_rows.slice(0, newColumns) })
    } else {
      const newColumnRows = [...layoutConfig.column_rows]
      for (let i = layoutConfig.columns; i < newColumns; i++) newColumnRows.push(6)
      setLayoutConfig({ ...layoutConfig, columns: newColumns, column_rows: newColumnRows })
    }
    setHasUnsavedChanges(true)
  }

  const handleColumnRowsChange = (colIndex, delta) => {
    const newRows = Math.max(1, Math.min(15, layoutConfig.column_rows[colIndex] + delta))
    if (newRows === layoutConfig.column_rows[colIndex]) return

    if (newRows < layoutConfig.column_rows[colIndex]) {
      const removedStudents = []
      const newSeatData = { ...seatData }
      for (let row = newRows; row < layoutConfig.column_rows[colIndex]; row++) {
        const key = `${colIndex}-${row}`
        if (newSeatData[key]?.student_id) {
          removedStudents.push(students.find(s => s.id === newSeatData[key].student_id))
          delete newSeatData[key]
        }
      }
      if (removedStudents.length > 0) {
        Modal.confirm({
          title: `第${colIndex + 1}列第${newRows + 1}排及之后有学生，删除后将返回未分配列表，确认吗？`,
          onOk: () => {
            setUnassignedStudents(prev => [...prev, ...removedStudents])
            setSeatData(newSeatData)
            const newColumnRows = [...layoutConfig.column_rows]
            newColumnRows[colIndex] = newRows
            setLayoutConfig({ ...layoutConfig, column_rows: newColumnRows })
            setHasUnsavedChanges(true)
          }
        })
        return
      }
    }

    const newColumnRows = [...layoutConfig.column_rows]
    newColumnRows[colIndex] = newRows
    setLayoutConfig({ ...layoutConfig, column_rows: newColumnRows })
    setHasUnsavedChanges(true)
  }

  const exportImage = async () => {
    const element = document.getElementById('seat-grid')
    if (!element) return
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false })
      const link = document.createElement('a')
      const className = classes.find(c => c.id === selectedClass)?.name || '座位表'
      link.download = `${className}-座位表.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      message.error('导出图片失败: ' + error.message)
    }
  }

  const exportExcel = () => {
    const maxRows = Math.max(...layoutConfig.column_rows)
    const data = []
    const className = classes.find(c => c.id === selectedClass)?.name || '座位表'
    data.push([className])
    data.push([])
    for (let row = 0; row < maxRows; row++) {
      const rowData = []
      for (let col = 0; col < layoutConfig.columns; col++) {
        if (row < layoutConfig.column_rows[col]) {
          const seat = seatData[`${col}-${row}`]
          rowData.push(seat?.student_id ? (students.find(s => s.id === seat.student_id)?.name || '') : '')
        } else {
          rowData.push('')
        }
      }
      data.push(rowData)
    }
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '座位表')
    XLSX.writeFile(wb, `${className}-座位表.xlsx`)
  }

  const getStudentById = (id) => students.find(s => s.id === id)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>座位管理</Title>
        <Space>
          <Select
            placeholder="选择班级"
            style={{ width: 160 }}
            value={selectedClass}
            onChange={setSelectedClass}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
          />
          {selectedClass && (
            <>
              <Button.Group>
                <Button type={view === 'teacher' ? 'primary' : 'default'} onClick={() => setView('teacher')}>👨‍🏫 教师</Button>
                <Button type={view === 'student' ? 'primary' : 'default'} onClick={() => setView('student')}>👨‍🎓 学生</Button>
              </Button.Group>
              <Button type="primary" onClick={handleSave} disabled={!hasUnsavedChanges} loading={loading}>保存</Button>
              <Button.Group>
                <Button onClick={exportImage}>导出图片</Button>
                <Button onClick={exportExcel}>导出Excel</Button>
              </Button.Group>
              <Button danger onClick={handleReset}>重置</Button>
            </>
          )}
        </Space>
      </div>

      {selectedClass ? (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 24 }}>
            {/* 左侧栏 */}
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="座位布局设置" size="small">
                {/* 列数 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8 }}>
                  <Text style={{ fontSize: 13 }}>列数</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Button size="small" shape="circle" onClick={() => handleColumnCountChange(-1)} style={{ lineHeight: 1 }}>−</Button>
                    <Text strong style={{ fontSize: 16, minWidth: 24, textAlign: 'center', display: 'inline-block' }}>{layoutConfig.columns}</Text>
                    <Button size="small" shape="circle" onClick={() => handleColumnCountChange(1)} style={{ lineHeight: 1 }}>+</Button>
                  </div>
                </div>
                {/* 各列行数 */}
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>各列行数</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {layoutConfig.column_rows.map((rows, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 6, background: idx % 2 === 0 ? '#fafafa' : '#fff', border: '1px solid #f0f0f0' }}>
                      <Text style={{ fontSize: 12, color: '#555' }}>第 {idx + 1} 列</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button size="small" shape="circle" onClick={() => handleColumnRowsChange(idx, -1)}>−</Button>
                        <Text strong style={{ fontSize: 13, minWidth: 18, textAlign: 'center', display: 'inline-block' }}>{rows}</Text>
                        <Button size="small" shape="circle" onClick={() => handleColumnRowsChange(idx, 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <UnassignedList students={unassignedStudents} />
            </div>

            {/* 座位网格 */}
            <div style={{ flex: 1 }}>
              <SeatGrid
                layoutConfig={layoutConfig}
                seatData={seatData}
                view={view}
                getStudentById={getStudentById}
              />
            </div>
          </div>

          <DragOverlay>
            {activeId ? (
              <div style={{ background: '#e6f4ff', border: '2px solid #1677ff', padding: '4px 12px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                {activeId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', marginTop: 80 }}>
          请选择班级开始管理座位
        </div>
      )}
    </div>
  )
}

function UnassignedList({ students }) {
  const { setNodeRef } = useDroppable({ id: 'unassigned-list', data: { type: 'unassigned' } })

  return (
    <Card
      title={<span>未分配学生 <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>({students.length}人)</Text></span>}
      size="small"
      ref={setNodeRef}
      style={{ flex: 1 }}
    >
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {students.length === 0 ? (
          <Text type="secondary" style={{ textAlign: 'center', padding: '16px 0', display: 'block', fontSize: 12 }}>所有学生已分配</Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {students.map(student => (
              <DraggableStudent key={student.id} student={student} type="unassigned" />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function DraggableStudent({ student, type, position }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student-${student.id}-${type}-${position || ''}`,
    data: { type, student, position }
  })

  const colors = student.gender === 'M'
    ? { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' }
    : student.gender === 'F'
      ? { bg: '#fff0f6', border: '#ffadd2', text: '#eb2f96' }
      : { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: '3px 8px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        cursor: 'move',
        opacity: isDragging ? 0.4 : 1,
        fontSize: 12,
        color: colors.text,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {student.name}
    </div>
  )
}

function SeatGrid({ layoutConfig, seatData, view, getStudentById }) {
  const maxRows = Math.max(...layoutConfig.column_rows)

  return (
    <Card id="seat-grid" style={{ height: '100%' }} styles={{ body: { padding: '16px 24px' } }}>
      {view === 'student' && (
        <div style={{ textAlign: 'center', marginBottom: 20, padding: '8px 0', background: '#f0f0f0', borderRadius: 6, fontSize: 13, color: '#666', letterSpacing: 2 }}>
          📋 讲台
        </div>
      )}
      <div style={{ display: 'flex', gap: 0, justifyContent: 'space-around', alignItems: 'flex-start' }}>
        {Array.from({ length: layoutConfig.columns }).map((_, colIdx) => (
          <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const actualRow = view === 'student' ? rowIdx : maxRows - 1 - rowIdx
              if (actualRow >= layoutConfig.column_rows[colIdx]) {
                return <div key={rowIdx} style={{ width: '100%', height: 52 }} />
              }
              const position = `${colIdx}-${actualRow}`
              const seat = seatData[position]
              const student = seat?.student_id ? getStudentById(seat.student_id) : null
              return <SeatCell key={rowIdx} position={position} student={student} />
            })}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>第{colIdx + 1}列</div>
          </div>
        ))}
      </div>
      {view === 'teacher' && (
        <div style={{ textAlign: 'center', marginTop: 20, padding: '8px 0', background: '#f0f0f0', borderRadius: 6, fontSize: 13, color: '#666', letterSpacing: 2 }}>
          📋 讲台
        </div>
      )}
    </Card>
  )
}

function SeatCell({ position, student }) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat-${position}`, data: { type: 'seat', position } })

  const colors = student
    ? student.gender === 'M'
      ? { bg: '#e6f4ff', border: '#91caff' }
      : student.gender === 'F'
        ? { bg: '#fff0f6', border: '#ffadd2' }
        : { bg: '#f6ffed', border: '#b7eb8f' }
    : { bg: '#fafafa', border: isOver ? '#1677ff' : '#e0e0e0' }

  return (
    <div
      ref={setNodeRef}
      style={{
        width: '100%',
        height: 52,
        background: colors.bg,
        border: `1.5px ${student ? 'solid' : 'dashed'} ${colors.border}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s',
        minWidth: 64,
      }}
    >
      {student ? (
        <DraggableStudent student={student} type="seat" position={position} />
      ) : (
        <Text type="secondary" style={{ fontSize: 11 }}>空位</Text>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import { classApi } from '../api/classes'
import { studentApi } from '../api/students'
import { seatApi } from '../api/seats'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

export default function SeatManage() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [view, setView] = useState('teacher') // 'teacher' | 'student'
  const [layoutConfig, setLayoutConfig] = useState({
    columns: 5,
    column_rows: [6, 6, 6, 6, 6],
    podium_position: 'bottom'
  })
  const [seatData, setSeatData] = useState({})
  const [unassignedStudents, setUnassignedStudents] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)

  // 加载班级列表
  useEffect(() => {
    loadClasses()
  }, [])

  // 加载班级学生和座位表
  useEffect(() => {
    if (selectedClass) {
      loadStudents()
      loadSeatArrangement()
    }
  }, [selectedClass])

  // 计算未分配学生
  useEffect(() => {
    if (students.length > 0) {
      const assignedIds = Object.values(seatData)
        .filter(seat => seat && seat.student_id)
        .map(seat => seat.student_id)

      const unassigned = students.filter(s => !assignedIds.includes(s.id))
      setUnassignedStudents(unassigned)
    }
  }, [students, seatData])

  const loadClasses = async () => {
    try {
      const res = await classApi.getClasses()
      setClasses(res.data)
    } catch (error) {
      console.error('加载班级失败:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const res = await studentApi.getStudents({ class_id: selectedClass })
      setStudents(res.data)
    } catch (error) {
      console.error('加载学生失败:', error)
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
        // 初始化默认布局
        setLayoutConfig({
          columns: 5,
          column_rows: [6, 6, 6, 6, 6],
          podium_position: 'bottom'
        })
        setSeatData({})
        setHasUnsavedChanges(false)
      }
    }
  }

  const handleSave = async () => {
    if (!selectedClass) return

    setLoading(true)
    try {
      await seatApi.saveSeatArrangement(selectedClass, {
        layout_config: layoutConfig,
        seat_data: seatData
      })
      setHasUnsavedChanges(false)
      alert('保存成功')
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!selectedClass) return
    if (!confirm('确定要重置座位表吗？')) return

    try {
      await seatApi.deleteSeatArrangement(selectedClass)
      setSeatData({})
      setHasUnsavedChanges(false)
      alert('重置成功')
    } catch (error) {
      alert('重置失败: ' + (error.response?.data?.detail || error.message))
    }
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

    // 场景 1: 从未分配列表拖到座位
    if (activeData.type === 'unassigned' && overData.type === 'seat') {
      const targetPos = overData.position

      // 如果目标座位有学生，将其返回未分配列表
      if (newSeatData[targetPos]?.student_id) {
        const existingStudentId = newSeatData[targetPos].student_id
        setUnassignedStudents([...unassignedStudents, students.find(s => s.id === existingStudentId)])
      }

      newSeatData[targetPos] = { student_id: activeData.student.id }
      setSeatData(newSeatData)
      setHasUnsavedChanges(true)
    }

    // 场景 2: 座位间交换
    if (activeData.type === 'seat' && overData.type === 'seat') {
      const sourcePos = activeData.position
      const targetPos = overData.position

      const temp = newSeatData[sourcePos]
      newSeatData[sourcePos] = newSeatData[targetPos] || null
      newSeatData[targetPos] = temp

      setSeatData(newSeatData)
      setHasUnsavedChanges(true)
    }

    // 场景 3: 从座位拖回未分配列表
    if (activeData.type === 'seat' && overData.type === 'unassigned') {
      const sourcePos = activeData.position
      if (newSeatData[sourcePos]?.student_id) {
        const studentId = newSeatData[sourcePos].student_id
        setUnassignedStudents([...unassignedStudents, students.find(s => s.id === studentId)])
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
      // 减少列数，检查是否有学生
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
        if (!confirm(`第${newColumns + 1}列及之后有${removedStudents.length}名学生，删除后将返回未分配列表，确认吗？`)) {
          return
        }
        setUnassignedStudents([...unassignedStudents, ...removedStudents])
        setSeatData(newSeatData)
      }

      setLayoutConfig({
        ...layoutConfig,
        columns: newColumns,
        column_rows: layoutConfig.column_rows.slice(0, newColumns)
      })
    } else {
      // 增加列数
      const newColumnRows = [...layoutConfig.column_rows]
      for (let i = layoutConfig.columns; i < newColumns; i++) {
        newColumnRows.push(6) // 默认6行
      }
      setLayoutConfig({
        ...layoutConfig,
        columns: newColumns,
        column_rows: newColumnRows
      })
    }
    setHasUnsavedChanges(true)
  }

  const handleColumnRowsChange = (colIndex, delta) => {
    const newRows = Math.max(1, Math.min(15, layoutConfig.column_rows[colIndex] + delta))
    if (newRows === layoutConfig.column_rows[colIndex]) return

    if (newRows < layoutConfig.column_rows[colIndex]) {
      // 减少行数，检查是否有学生
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
        if (!confirm(`第${colIndex + 1}列第${newRows + 1}排及之后有学生，删除后将返回未分配列表，确认吗？`)) {
          return
        }
        setUnassignedStudents([...unassignedStudents, ...removedStudents])
        setSeatData(newSeatData)
      }
    }

    const newColumnRows = [...layoutConfig.column_rows]
    newColumnRows[colIndex] = newRows
    setLayoutConfig({
      ...layoutConfig,
      column_rows: newColumnRows
    })
    setHasUnsavedChanges(true)
  }

  const exportImage = async () => {
    const element = document.getElementById('seat-grid')
    if (!element) return

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
      })
      const link = document.createElement('a')
      const className = classes.find(c => c.id === selectedClass)?.name || '座位表'
      link.download = `${className}-座位表.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      alert('导出图片失败: ' + error.message)
    }
  }

  const exportExcel = () => {
    const maxRows = Math.max(...layoutConfig.column_rows)
    const data = []

    // 添加标题行
    const className = classes.find(c => c.id === selectedClass)?.name || '座位表'
    data.push([className])
    data.push([])

    // 添加座位数据
    for (let row = 0; row < maxRows; row++) {
      const rowData = []
      for (let col = 0; col < layoutConfig.columns; col++) {
        if (row < layoutConfig.column_rows[col]) {
          const key = `${col}-${row}`
          const seat = seatData[key]
          if (seat?.student_id) {
            const student = students.find(s => s.id === seat.student_id)
            rowData.push(student?.name || '')
          } else {
            rowData.push('')
          }
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

  const getStudentById = (id) => {
    return students.find(s => s.id === id)
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">座位管理</h1>

        <div className="flex items-center gap-4">
          {/* 班级选择 */}
          <select
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(Number(e.target.value))}
            className="px-4 py-2 border rounded"
          >
            <option value="">选择班级</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selectedClass && (
            <>
              {/* 视角切换 */}
              <div className="inline-flex rounded-lg border">
                <button
                  onClick={() => setView('teacher')}
                  className={`px-4 py-2 ${view === 'teacher' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                >
                  👨‍🏫 教师
                </button>
                <button
                  onClick={() => setView('student')}
                  className={`px-4 py-2 ${view === 'student' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                >
                  👨‍🎓 学生
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || loading}
                className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>

              {/* 导出按钮 */}
              <div className="relative group">
                <button className="px-4 py-2 bg-blue-500 text-white rounded">
                  导出 ▼
                </button>
                <div className="hidden group-hover:block absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                  <button
                    onClick={exportImage}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    导出图片
                  </button>
                  <button
                    onClick={exportExcel}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    导出Excel
                  </button>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                重置
              </button>
            </>
          )}
        </div>
      </div>

      {selectedClass && (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6">
            {/* 左侧栏 */}
            <div className="w-80 space-y-6">
              {/* 布局设置 */}
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-bold mb-4">座位布局设置</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2">列数: {layoutConfig.columns}</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleColumnCountChange(-1)}
                        className="px-3 py-1 bg-gray-200 rounded"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleColumnCountChange(1)}
                        className="px-3 py-1 bg-gray-200 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2">单独调整:</label>
                    {layoutConfig.column_rows.map((rows, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <span className="text-sm w-16">第{idx + 1}列:</span>
                        <button
                          onClick={() => handleColumnRowsChange(idx, -1)}
                          className="px-2 py-1 bg-gray-200 rounded text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{rows}</span>
                        <button
                          onClick={() => handleColumnRowsChange(idx, 1)}
                          className="px-2 py-1 bg-gray-200 rounded text-sm"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 未分配学生列表 */}
              <UnassignedList students={unassignedStudents} />
            </div>

            {/* 座位网格 */}
            <div className="flex-1">
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
              <div className="bg-blue-100 border-2 border-blue-500 px-3 py-2 rounded shadow-lg">
                {activeId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!selectedClass && (
        <div className="text-center text-gray-500 mt-20">
          请选择班级开始管理座位
        </div>
      )}
    </div>
  )
}

// 未分配学生列表组件
function UnassignedList({ students }) {
  const { setNodeRef } = useDroppable({
    id: 'unassigned-list',
    data: { type: 'unassigned' }
  })

  return (
    <div ref={setNodeRef} className="bg-white p-4 rounded shadow">
      <h3 className="font-bold mb-4">未分配学生 ({students.length})</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {students.map(student => (
          <DraggableStudent key={student.id} student={student} type="unassigned" />
        ))}
        {students.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-4">
            所有学生已分配
          </div>
        )}
      </div>
    </div>
  )
}

// 可拖拽学生组件
function DraggableStudent({ student, type, position }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student-${student.id}-${type}-${position || ''}`,
    data: { type, student, position }
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 bg-blue-50 border border-blue-200 rounded cursor-move hover:bg-blue-100 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {student.name}
    </div>
  )
}

// 座位网格组件
function SeatGrid({ layoutConfig, seatData, view, getStudentById }) {
  const maxRows = Math.max(...layoutConfig.column_rows)

  return (
    <div id="seat-grid" className="bg-white p-6 rounded shadow">
      {/* 讲台 */}
      {view === 'student' && (
        <div className="text-center mb-4 py-2 bg-gray-200 rounded">
          讲台 ▼
        </div>
      )}

      {/* 座位网格 */}
      <div className="flex gap-4 justify-center">
        {Array.from({ length: layoutConfig.columns }).map((_, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-2">
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const actualRow = view === 'student' ? rowIdx : maxRows - 1 - rowIdx

              if (actualRow >= layoutConfig.column_rows[colIdx]) {
                return <div key={rowIdx} className="w-24 h-16" />
              }

              const position = `${colIdx}-${actualRow}`
              const seat = seatData[position]
              const student = seat?.student_id ? getStudentById(seat.student_id) : null

              return (
                <SeatCell
                  key={rowIdx}
                  position={position}
                  student={student}
                />
              )
            })}
            <div className="text-center text-sm text-gray-500 mt-2">
              第{colIdx + 1}列
            </div>
          </div>
        ))}
      </div>

      {/* 讲台 */}
      {view === 'teacher' && (
        <div className="text-center mt-4 py-2 bg-gray-200 rounded">
          讲台 ▲
        </div>
      )}
    </div>
  )
}

// 座位格子组件
function SeatCell({ position, student }) {
  const { setNodeRef } = useDroppable({
    id: `seat-${position}`,
    data: { type: 'seat', position }
  })

  return (
    <div
      ref={setNodeRef}
      className="w-24 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center"
    >
      {student ? (
        <DraggableStudent student={student} type="seat" position={position} />
      ) : (
        <span className="text-gray-400 text-sm">空</span>
      )}
    </div>
  )
}

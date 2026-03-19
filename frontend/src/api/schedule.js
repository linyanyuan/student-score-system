import request from './request'

// 获取所有节次列表
export const getSchedulePeriods = () => {
  return request.get('/api/schedule-periods')
}

// 创建节次（仅管理员）
export const createSchedulePeriod = (data) => {
  return request.post('/api/schedule-periods', data)
}

// 更新节次（仅管理员）
export const updateSchedulePeriod = (id, data) => {
  return request.put(`/api/schedule-periods/${id}`, data)
}

// 删除节次（仅管理员）
export const deleteSchedulePeriod = (id) => {
  return request.delete(`/api/schedule-periods/${id}`)
}

// 获取当前教师的课表
export const getMySchedule = () => {
  return request.get('/api/teacher-schedules/my-schedule')
}

// 获取指定教师的课表（仅管理员）
export const getTeacherSchedule = (teacherId) => {
  return request.get(`/api/teacher-schedules/${teacherId}`)
}

// 创建或更新课表项
export const createOrUpdateSchedule = (data) => {
  return request.post('/api/teacher-schedules', data)
}

// 删除课表项
export const deleteSchedule = (id) => {
  return request.delete(`/api/teacher-schedules/${id}`)
}

// 获取备忘录列表
export const getMemos = (params) => {
  return request.get('/api/memos', { params })
}

// 创建备忘录
export const createMemo = (data) => {
  return request.post('/api/memos', data)
}

// 更新备忘录
export const updateMemo = (id, data) => {
  return request.put(`/api/memos/${id}`, data)
}

// 删除备忘录
export const deleteMemo = (id) => {
  return request.delete(`/api/memos/${id}`)
}

// 更新备忘录状态
export const updateMemoStatus = (id, status) => {
  return request.patch(`/api/memos/${id}/status`, null, { params: { status_value: status } })
}

// 获取每日语句
export const getDailyQuote = () => {
  return request.get('/api/daily-quote')
}

import request from './request'

export const getLessonPlan = (grade) => request.get(`/api/schedule/lesson-plan/${encodeURIComponent(grade)}`)
export const saveLessonPlan = (data) => request.post('/api/schedule/lesson-plan', data)

export const getTeachingArrangement = (grade) =>
  request.get(`/api/schedule/teaching-arrangement/${encodeURIComponent(grade)}`)
export const saveTeachingArrangement = (data) => request.post('/api/schedule/teaching-arrangement', data)

export const createAutoScheduleTask = (grade) =>
  request.post(`/api/schedule/auto/${encodeURIComponent(grade)}`)
export const getScheduleTask = (taskId) => request.get(`/api/schedule/tasks/${taskId}`)

export const getClassTimetable = (classId) => request.get(`/api/timetable/class/${classId}`)
export const getTeacherTimetable = (teacherId) => request.get(`/api/timetable/teacher/${teacherId}`)

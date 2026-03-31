import request from './request'

export const getScheduleTeachers = () => request.get('/api/auth/teachers')

export const getLessonPlan = (grade) => request.get(`/api/schedule/lesson-plan/${encodeURIComponent(grade)}`)
export const saveLessonPlan = (data) => request.post('/api/schedule/lesson-plan', data)

export const getTeachingArrangement = (grade) =>
  request.get(`/api/schedule/teaching-arrangement/${encodeURIComponent(grade)}`)
export const saveTeachingArrangement = (data) => request.post('/api/schedule/teaching-arrangement', data)

export const getLessonPlanOverrides = (grade) =>
  request.get(`/api/schedule/lesson-plan-overrides/${encodeURIComponent(grade)}`)
export const saveLessonPlanOverrides = (data) => request.post('/api/schedule/lesson-plan-overrides', data)

export const getTeacherConstraints = (grade) =>
  request.get(`/api/schedule/teacher-constraints/${encodeURIComponent(grade)}`)
export const saveTeacherConstraints = (data) => request.post('/api/schedule/teacher-constraints', data)

export const getTimetableLocks = (grade) => request.get(`/api/schedule/locks/${encodeURIComponent(grade)}`)
export const saveTimetableLocks = (data) => request.post('/api/schedule/locks', data)

export const solveScheduleDraft = (grade) =>
  request.post(`/api/schedule/drafts/${encodeURIComponent(grade)}/solve`)
export const getScheduleTask = (taskId) => request.get(`/api/schedule/tasks/${taskId}`)

export const getScheduleDraft = (draftId) => request.get(`/api/schedule/drafts/${draftId}`)
export const getScheduleDraftItems = (draftId) => request.get(`/api/schedule/drafts/${draftId}/items`)
export const publishScheduleDraft = (draftId) => request.post(`/api/schedule/drafts/${draftId}/publish`)

export const getClassTimetable = (classId) => request.get(`/api/timetable/class/${classId}`)
export const getTeacherTimetable = (teacherId) => request.get(`/api/timetable/teacher/${teacherId}`)
export const getMyTimetable = () => request.get('/api/timetable/my')

export const createAutoScheduleTask = (grade) => request.post(`/api/schedule/drafts/${encodeURIComponent(grade)}/solve`)


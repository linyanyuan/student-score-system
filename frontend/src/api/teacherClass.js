import request from './request'

export const getTeacherClasses = (teacherId) =>
  request.get('/api/teacher-classes', { params: teacherId ? { teacher_id: teacherId } : {} })
export const createTeacherClass = (data) => request.post('/api/teacher-classes', data)
export const deleteTeacherClass = (id) => request.delete(`/api/teacher-classes/${id}`)

export const getTeacherSubjectAssignments = (teacherId) =>
  request.get('/api/teacher-classes/subject-assignments', { params: teacherId ? { teacher_id: teacherId } : {} })

export const createTeacherSubjectAssignments = (data) =>
  request.post('/api/teacher-classes/subject-assignments', data)

export const deleteTeacherSubjectAssignment = (id) =>
  request.delete(`/api/teacher-classes/subject-assignments/${id}`)

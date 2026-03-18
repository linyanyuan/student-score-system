import request from './request'

// 学生分析
export const getStudentTotalTrend = (studentId) =>
  request.get(`/api/analysis/student/${studentId}/total-trend`)

export const getStudentSubjectTrend = (studentId, subjectId) =>
  request.get(`/api/analysis/student/${studentId}/subject-trend`, { params: { subject_id: subjectId } })

export const getStudentRankTrend = (studentId) =>
  request.get(`/api/analysis/student/${studentId}/rank-trend`)

export const getStudentSubjectComparison = (studentId, examId) =>
  request.get(`/api/analysis/student/${studentId}/subject-comparison`, { params: { exam_id: examId } })

// 班级分析
export const getClassesRank = (examId, subjectId) =>
  request.get('/api/analysis/classes/rank', { params: { exam_id: examId, subject_id: subjectId } })

export const getClassDistribution = (classId, examId) =>
  request.get(`/api/analysis/class/${classId}/exam/${examId}/distribution`)

export const getClassBottomStudents = (classId, examId, limit = 10) =>
  request.get(`/api/analysis/class/${classId}/exam/${examId}/bottom-students`, { params: { limit } })

export const getClassBiasedStudents = (classId, examId) =>
  request.get(`/api/analysis/class/${classId}/exam/${examId}/biased-students`)

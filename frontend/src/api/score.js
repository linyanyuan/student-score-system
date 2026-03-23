import request from './request'

export const getScores = (params) => request.get('/api/scores', { params })
export const createScore = (data) => request.post('/api/scores', data)
export const updateScore = (id, data) => request.put(`/api/scores/${id}`, data)
export const upsertScore = (data) => request.put('/api/scores/upsert', data)
export const deleteScore = (id) => request.delete(`/api/scores/${id}`)
export const deleteScoreByStudent = (examId, studentId) =>
  request.delete('/api/scores/by-student', { params: { exam_id: examId, student_id: studentId } })
export const batchDeleteScoresByStudents = (examId, studentIds) =>
  request.post('/api/scores/batch-by-students/delete', { exam_id: examId, student_ids: studentIds })
export const importScores = (file, examId, grade) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/api/scores/import?exam_id=${examId}&grade=${encodeURIComponent(grade)}`, formData)
}
export const exportScores = (params) =>
  request.get('/api/scores/export', { params, responseType: 'blob' })
export const downloadScoreTemplate = () =>
  request.get('/api/scores/template', { responseType: 'blob' })

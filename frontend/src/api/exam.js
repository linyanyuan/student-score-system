import request from './request'

export const getExams = (params) => request.get('/api/exams', { params })
export const createExam = (data) => request.post('/api/exams', data)
export const updateExam = (id, data) => request.put(`/api/exams/${id}`, data)
export const deleteExam = (id) => request.delete(`/api/exams/${id}`)

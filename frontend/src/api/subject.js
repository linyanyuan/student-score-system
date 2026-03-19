import request from './request'

export const getSubjects = () => request.get('/api/subjects')
export const createSubject = (data) => request.post('/api/subjects', data)
export const updateSubject = (id, data) => request.put(`/api/subjects/${id}`, data)
export const deleteSubject = (id) => request.delete(`/api/subjects/${id}`)

import request from './request'

export const getClasses = (params) => request.get('/api/classes', { params })
export const createClass = (data) => request.post('/api/classes', data)
export const updateClass = (id, data) => request.put(`/api/classes/${id}`, data)
export const deleteClass = (id) => request.delete(`/api/classes/${id}`)

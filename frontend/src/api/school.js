import request from './request'

export const getSchools = () => request.get('/api/schools')
export const createSchool = (data) => request.post('/api/schools', data)
export const updateSchool = (id, data) => request.put(`/api/schools/${id}`, data)
export const deleteSchool = (id) => request.delete(`/api/schools/${id}`)

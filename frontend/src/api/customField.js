import request from './request'

export const getCustomFields = () => request.get('/api/custom-fields')
export const createCustomField = (data) => request.post('/api/custom-fields', data)
export const updateCustomField = (id, data) => request.put(`/api/custom-fields/${id}`, data)
export const deleteCustomField = (id) => request.delete(`/api/custom-fields/${id}`)

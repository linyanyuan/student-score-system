import request from './request'

export const getAccounts = (keyword) => request.get('/api/accounts', { params: { keyword } })
export const createAccount = (data) => request.post('/api/accounts', data)
export const updateAccount = (id, data) => request.put(`/api/accounts/${id}`, data)
export const deleteAccount = (id) => request.delete(`/api/accounts/${id}`)
export const batchDeleteAccounts = (ids) => request.delete('/api/accounts', { data: { ids } })

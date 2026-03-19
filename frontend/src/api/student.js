import request from './request'

export const getStudents = (params) => request.get('/api/students', { params })
export const getStudent = (id) => request.get(`/api/students/${id}`)
export const createStudent = (data) => request.post('/api/students', data)
export const updateStudent = (id, data) => request.put(`/api/students/${id}`, data)
export const deleteStudent = (id) => request.delete(`/api/students/${id}`)
export const importStudents = (file, classId) => {
  const formData = new FormData()
  formData.append('file', file)
  const params = classId ? { class_id: classId } : {}
  return request.post('/api/students/import', formData, { params })
}
export const exportStudents = (params) =>
  request.get('/api/students/export', { params, responseType: 'blob' })
export const deleteStudents = (ids) => request.delete('/api/students/batch', { data: { ids } })
export const downloadTemplate = () =>
  request.get('/api/students/template', { responseType: 'blob' })

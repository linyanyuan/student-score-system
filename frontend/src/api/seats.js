import request from './request'

export const seatApi = {
  // 获取班级座位表
  getSeatArrangement: (classId) => {
    return request.get(`/api/seats/${classId}`)
  },

  // 保存座位表
  saveSeatArrangement: (classId, data) => {
    return request.post(`/api/seats/${classId}`, data)
  },

  // 删除座位表
  deleteSeatArrangement: (classId) => {
    return request.delete(`/api/seats/${classId}`)
  }
}

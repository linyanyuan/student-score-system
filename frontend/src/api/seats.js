import api from './axios'

export const seatApi = {
  // 获取班级座位表
  getSeatArrangement: (classId) => {
    return api.get(`/seats/${classId}`)
  },

  // 保存座位表
  saveSeatArrangement: (classId, data) => {
    return api.post(`/seats/${classId}`, data)
  },

  // 删除座位表
  deleteSeatArrangement: (classId) => {
    return api.delete(`/seats/${classId}`)
  }
}

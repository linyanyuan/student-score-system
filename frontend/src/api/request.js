import axios from 'axios'
import {
  clearSessionAuth,
  getToken,
  isSessionIdleExpired,
  recordSessionActivity,
  redirectToLogin,
} from '../utils/session'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      if (isSessionIdleExpired()) {
        clearSessionAuth()
        redirectToLogin('idle')
        return Promise.reject(new Error('登录已失效，请重新登录'))
      }
      config.headers.Authorization = `Bearer ${token}`
      recordSessionActivity()
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    recordSessionActivity()
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.url?.includes('/api/auth/login')) {
        return Promise.reject(error)
      }
      clearSessionAuth()
      redirectToLogin('unauthorized')
      return Promise.reject(error)
    }

    const status = error.response?.status
    const detail = error.response?.data?.detail
    let message = detail || ''
    if (!message && status >= 500) {
      message = '服务器异常，请稍后重试'
    }
    if (!message) {
      message = '网络连接失败，请检查后端服务是否启动'
    }

    return Promise.reject(new Error(message))
  }
)

export default request

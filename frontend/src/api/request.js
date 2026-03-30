import axios from 'axios'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 登录接口 401 直接返回，不跳转。
      if (error.config?.url?.includes('/api/auth/login')) {
        return Promise.reject(error)
      }
      // 其他接口 401 清理 token 并跳转登录页。
      localStorage.removeItem('token')
      window.location.href = '/login'
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

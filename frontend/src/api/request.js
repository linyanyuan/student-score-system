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
      // 如果是登录接口的 401 错误，不跳转，直接返回错误
      if (error.config?.url?.includes('/api/auth/login')) {
        return Promise.reject(error)
      }
      // 其他接口的 401 错误，清除 token 并跳转到登录页
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    const message = error.response?.data?.detail || '网络连接失败，请检查网络'
    return Promise.reject(new Error(message))
  }
)

export default request

/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import request from '../api/request'
import {
  clearSessionAuth,
  getToken,
  isSessionIdleExpired,
  recordSessionActivity,
  redirectToLogin,
  setToken,
} from '../utils/session'

const AuthContext = createContext(null)

const SESSION_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearAuthState = useCallback((reason) => {
    clearSessionAuth()
    setUser(null)
    if (reason) {
      redirectToLogin(reason)
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    if (token) {
      if (isSessionIdleExpired()) {
        clearSessionAuth()
        redirectToLogin('idle')
        setLoading(false)
        return
      }

      recordSessionActivity(true)
      request
        .get('/api/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => clearAuthState('unauthorized'))
        .finally(() => setLoading(false))
      return
    }

    setLoading(false)
  }, [clearAuthState])

  useEffect(() => {
    if (!user) return undefined

    let lastWrite = 0
    const markActivity = () => {
      const now = Date.now()
      if (now - lastWrite < 10 * 1000) return
      lastWrite = now
      recordSessionActivity(true, now)
    }

    recordSessionActivity(true)

    SESSION_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true })
    })
    window.addEventListener('visibilitychange', markActivity)

    const timer = window.setInterval(() => {
      if (isSessionIdleExpired()) {
        clearAuthState('idle')
      }
    }, 15 * 1000)

    return () => {
      window.clearInterval(timer)
      SESSION_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity)
      })
      window.removeEventListener('visibilitychange', markActivity)
    }
  }, [user, clearAuthState])

  const login = async (username, password) => {
    const { data } = await request.post('/api/auth/login', { username, password })
    setToken(data.access_token)
    const { data: userData } = await request.get('/api/auth/me')
    setUser(userData)
  }

  const register = async (username, password, role) => {
    await request.post('/api/auth/register', { username, password, role })
  }

  const logout = () => {
    clearSessionAuth()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}



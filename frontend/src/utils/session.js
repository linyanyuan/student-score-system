const TOKEN_KEY = 'token'
const LAST_ACTIVITY_KEY = 'session:last_activity_at'
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000
const MIN_IDLE_TIMEOUT_MS = 60 * 1000
const ACTIVITY_WRITE_GAP_MS = 10 * 1000

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getSessionIdleTimeoutMs() {
  const envValue = toNumber(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS)
  if (envValue == null) return DEFAULT_IDLE_TIMEOUT_MS
  return Math.max(MIN_IDLE_TIMEOUT_MS, envValue)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  recordSessionActivity(true)
}

export function clearSessionAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function recordSessionActivity(force = false, now = Date.now()) {
  const last = toNumber(localStorage.getItem(LAST_ACTIVITY_KEY))
  if (!force && last != null && now - last < ACTIVITY_WRITE_GAP_MS) {
    return
  }
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
}

export function isSessionIdleExpired(now = Date.now()) {
  const last = toNumber(localStorage.getItem(LAST_ACTIVITY_KEY))
  if (last == null) return false
  return now - last >= getSessionIdleTimeoutMs()
}

export function redirectToLogin(reason) {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/login') return
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  window.location.href = `/login${suffix}`
}

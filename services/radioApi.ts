const RADIO_BASE = 'https://radio-api.helpushelpua.com/api'
const TOKEN_KEY = 'ampub_radio_token'
const USER_KEY = 'ampub_radio_user'

export type RadioUser = { id: number; nickname: string; color: string }

export const RADIO_COLORS = ['#e8836a', '#f3c83e', '#7c8a6e', '#60a5fa', '#f472b6', '#a78bfa', '#22d3ee']

export type RadioMessage = {
  id: number
  user_id: number
  nickname: string
  color: string
  text: string
  msg_type: 'chat' | 'announcement' | 'podcast'
  meta_title?: string
  meta_description?: string
  meta_url?: string
  meta_image?: string
  is_deleted: boolean
  is_pinned: boolean
  pinned_at?: string
  created_at: string
  reply_to_id: number | null
  reply_to: { id: number; nickname: string; text: string } | null
  edited_at?: string
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

export type PollResult = {
  messages: RadioMessage[]
  typing: { nickname: string; color: string }[]
  reaction_updates: { message_id: number; reactions: RadioMessage['reactions'] }[]
}

export type SendMessagePayload = {
  text: string
  msg_type?: 'chat' | 'announcement' | 'podcast'
  meta_title?: string
  meta_description?: string
  meta_url?: string
  meta_image?: string
  reply_to_id?: number | null
}

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }

export function getRadioUser(): RadioUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || '') } catch { return null }
}

function saveSession(token: string, user: RadioUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function saveRadioUser(user: RadioUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${RADIO_BASE}${path}`, { ...opts, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `${res.status}`)
  return body.data as T
}

export async function radioGuestJoin(nickname?: string): Promise<RadioUser> {
  const data = await req<{ token: string; user: RadioUser }>('/auth/guest', {
    method: 'POST',
    body: JSON.stringify(nickname ? { nickname } : {}),
  })
  saveSession(data.token, data.user)
  return data.user
}

export async function fetchRadioMessages(): Promise<RadioMessage[]> {
  return req<RadioMessage[]>('/chat/messages')
}

export async function fetchPinnedMessages(): Promise<RadioMessage[]> {
  return req<RadioMessage[]>('/chat/pinned')
}

export async function pollRadioMessages(afterId: number): Promise<PollResult> {
  return req<PollResult>(`/chat/poll?after_id=${afterId}`)
}

export async function sendRadioMessage(payload: SendMessagePayload): Promise<RadioMessage> {
  return req<RadioMessage>('/chat/messages', { method: 'POST', body: JSON.stringify(payload) })
}

export async function pinRadioMessage(id: number): Promise<{ id: number; is_pinned: boolean }> {
  return req(`/chat/messages/${id}/pin`, { method: 'POST' })
}

export async function fetchRadioOnline(): Promise<RadioUser[]> {
  return req<RadioUser[]>('/chat/online')
}

export async function renameMe(nickname: string, color?: string): Promise<RadioUser> {
  const user = await req<RadioUser>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(color ? { nickname, color } : { nickname }),
  })
  saveRadioUser(user)
  return user
}

export async function editRadioMessage(id: number, text: string): Promise<{ id: number; text: string; edited_at: string }> {
  return req(`/chat/messages/${id}`, { method: 'PUT', body: JSON.stringify({ text }) })
}

export async function deleteRadioMessage(id: number): Promise<void> {
  return req(`/chat/messages/${id}`, { method: 'DELETE' })
}

export async function reactRadioMessage(id: number, emoji: string): Promise<{ message_id: number; reactions: RadioMessage['reactions'] }> {
  return req(`/chat/messages/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) })
}

export async function sendRadioTyping(): Promise<void> {
  try { await req<void>('/chat/typing', { method: 'POST' }) } catch { /* non-critical */ }
}

// ── Admin API ────────────────────────────────────────────────────────────────
const ADMIN_TOKEN_KEY = 'ampub_radio_admin_token'
export function getAdminToken() { return sessionStorage.getItem(ADMIN_TOKEN_KEY) }
export function saveAdminToken(t: string) { sessionStorage.setItem(ADMIN_TOKEN_KEY, t) }
export function clearAdminToken() { sessionStorage.removeItem(ADMIN_TOKEN_KEY) }

async function adminReq<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['X-Admin-Token'] = token
  const res = await fetch(`${RADIO_BASE}${path}`, { ...opts, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `${res.status}`)
  return body.data as T
}

export async function adminLogin(password: string): Promise<string> {
  const data = await adminReq<{ token: string }>('/admin/login', {
    method: 'POST', body: JSON.stringify({ password }),
  })
  saveAdminToken(data.token)
  return data.token
}

export async function adminClearChat(): Promise<{ cleared: number }> {
  return adminReq('/admin/clear-chat', { method: 'POST' })
}

export async function adminUnpinAll(): Promise<void> {
  return adminReq('/admin/unpin-all', { method: 'POST' })
}

export async function adminPin(id: number): Promise<{ id: number; is_pinned: boolean }> {
  return adminReq(`/admin/messages/${id}/pin`, { method: 'POST' })
}

export type AnnouncePayload = {
  msg_type: 'announcement' | 'podcast'
  text?: string
  meta_title?: string
  meta_description?: string
  meta_url?: string
  meta_image?: string
  pinned?: boolean
}
export async function adminAnnounce(payload: AnnouncePayload): Promise<{ id: number }> {
  return adminReq('/admin/announce', { method: 'POST', body: JSON.stringify(payload) })
}

// ── Editorial radio-page config ───────────────────────────────────────────────
export type ScheduleEntry = { time: string; title: string; host?: string }
export type RadioConfig = {
  hero_image?: string
  now_title?: string
  now_host?: string
  now_description?: string
  guest_name?: string
  guest_role?: string
  guest_time?: string
  guest_duration?: string
  schedule?: ScheduleEntry[]
  book_title?: string
  book_author?: string
  book_image?: string
  book_url?: string
  telegram?: string
}

export async function fetchRadioConfig(): Promise<RadioConfig> {
  try { return await req<RadioConfig>('/radio/config') } catch { return {} }
}

export async function saveRadioConfig(cfg: RadioConfig): Promise<RadioConfig> {
  // Admin-token protected (X-Admin-Token via adminReq), public path though.
  return adminReq<RadioConfig>('/radio/config', { method: 'PUT', body: JSON.stringify(cfg) })
}

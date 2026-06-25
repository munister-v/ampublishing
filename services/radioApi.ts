const RADIO_BASE = 'https://radio-api.helpushelpua.com/api'
const TOKEN_KEY = 'ampub_radio_token'
const USER_KEY = 'ampub_radio_user'

export type RadioUser = { id: number; nickname: string; color: string }

export type RadioMessage = {
  id: number
  user_id: number
  nickname: string
  color: string
  text: string
  is_deleted: boolean
  created_at: string
  reply_to_id: number | null
  reply_to: { id: number; nickname: string; text: string } | null
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

export type PollResult = {
  messages: RadioMessage[]
  typing: { nickname: string; color: string }[]
  reaction_updates: { message_id: number; reactions: RadioMessage['reactions'] }[]
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRadioUser(): RadioUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || '') } catch { return null }
}

function saveSession(token: string, user: RadioUser) {
  localStorage.setItem(TOKEN_KEY, token)
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

export async function pollRadioMessages(afterId: number): Promise<PollResult> {
  return req<PollResult>(`/chat/poll?after_id=${afterId}`)
}

export async function sendRadioMessage(text: string): Promise<RadioMessage> {
  return req<RadioMessage>('/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ text, reply_to_id: null }),
  })
}

export async function fetchRadioOnline(): Promise<RadioUser[]> {
  return req<RadioUser[]>('/chat/online')
}

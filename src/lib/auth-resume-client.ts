import type { Session } from '@supabase/supabase-js'

export interface AuthResumeUser {
  id: string
  email?: string
}

export interface AuthResumePayload {
  user: AuthResumeUser
  colonyId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasAccessTokenCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('supabase-access-token='))
}

function parseResumePayload(value: unknown): AuthResumePayload | null {
  if (!isRecord(value) || !isRecord(value.user)) return null
  if (typeof value.user.id !== 'string' || typeof value.colonyId !== 'string') return null
  return {
    user: {
      id: value.user.id,
      email: typeof value.user.email === 'string' ? value.user.email : undefined,
    },
    colonyId: value.colonyId,
  }
}

export function formatAuthError(err: unknown): string {
  const message = String(err)
  return message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('ERR_NAME_NOT_RESOLVED')
    ? 'Сервер Supabase недоступен. Возможно, проект приостановлен — восстановите его в дашборде Supabase.'
    : message
}

export function syncSupabaseAccessTokenCookie(session: Pick<Session, 'access_token' | 'expires_in'> | null): void {
  if (!session) {
    document.cookie = `supabase-access-token=; path=/; max-age=0`
    return
  }
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `supabase-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax${secure}`
}

export async function loadAuthResume(): Promise<AuthResumePayload | null> {
  if (!hasAccessTokenCookie()) return null

  const res = await fetch('/api/auth/resume', { cache: 'no-store' })
  if (res.status === 401 || res.status === 403 || res.status === 404) return null

  const data: unknown = await res.json()
  if (!res.ok) {
    const message = isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string'
      ? data.error.message
      : 'Auth resume failed'
    throw new Error(message)
  }

  return parseResumePayload(data)
}

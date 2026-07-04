import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTelegramState = {
  colonyId: null,
  loading: false,
  error: null,
  isTWA: false,
  tgUser: null,
}
const mockGetBrowserSupabase = vi.fn()
let storage = new Map<string, string>()
let cookieJar = ''

vi.mock('@/hooks/useTelegramAuth', () => ({
  useTelegramAuth: () => mockTelegramState,
}))

vi.mock('@/lib/browser-supabase', () => ({
  getBrowserSupabase: () => mockGetBrowserSupabase(),
}))

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('NEXT_PUBLIC_E2E_AUTH_BYPASS', '0')
  storage = new Map<string, string>()
  cookieJar = ''
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => { storage.clear() },
    },
  })
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieJar,
    set: (value: string) => {
      cookieJar = value.includes('max-age=0') ? '' : value.split(';')[0]
    },
  })
  document.cookie = 'supabase-access-token=; path=/; max-age=0'
  document.cookie = 'supabase-access-token=resume-token; path=/'
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      user: { id: USER_ID, email: 'commander@mars2050.test' },
      colonyId: COLONY_ID,
    }),
  })
})

describe('useAuth authenticated resume', () => {
  it('uses the cookie resume endpoint before importing Supabase auth', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.user?.id).toBe(USER_ID))

    expect(result.current.loading).toBe(false)
    expect(result.current.colonyId).toBe(COLONY_ID)
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/resume', { cache: 'no-store' })
    expect(mockGetBrowserSupabase).not.toHaveBeenCalled()
    expect(storage.get(`mars2050_colony_id:${USER_ID}`)).toBe(COLONY_ID)
  })
})

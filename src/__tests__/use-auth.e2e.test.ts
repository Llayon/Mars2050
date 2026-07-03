import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTelegramState = {
  colonyId: null,
  loading: false,
  error: null,
  isTWA: false,
  tgUser: null,
}

vi.mock('@/hooks/useTelegramAuth', () => ({
  useTelegramAuth: () => mockTelegramState,
}))

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('NEXT_PUBLIC_E2E_AUTH_BYPASS', '1')
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      user: { id: USER_ID, email: 'mars2050_e2e_smoke@mars2050.local' },
      colonyId: COLONY_ID,
    }),
  })
})

describe('useAuth e2e bypass', () => {
  it('loads e2e session and sets user, colonyId and loading=false', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user?.id).toBe(USER_ID)
    expect(result.current.colonyId).toBe(COLONY_ID)
    expect(result.current.isTWA).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('/api/e2e/session')
  })

  it('clears local auth state on logout in e2e mode', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.colonyId).toBeNull()
  })
})

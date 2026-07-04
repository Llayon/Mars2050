import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColonyBootstrapPayload } from '@/domains/colony/colony.types'
import { readBootstrapCache, writeBootstrapCache } from '@/lib/bootstrap-cache'
import { markLoadMilestone } from '@/lib/load-milestones'

const mockFetchWithAuth = vi.fn()

vi.mock('@/lib/fetch-with-auth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}))

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
let storage = new Map<string, string>()

function payload(name: string): ColonyBootstrapPayload {
  return {
    colony: {
      id: COLONY_ID,
      name,
      level: 1,
      experience: 0,
      user_id: USER_ID,
      last_calc_at: '2026-07-04T12:00:00.000Z',
      created_at: '2026-07-04T11:00:00.000Z',
      terrain_grid: [{ x: 0, y: 0, t: 'regolith' }],
      unlocked_radius: 5,
    },
    resources: [],
    buildings: [],
    population: null,
  }
}

function createPending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map() } }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  performance.clearMarks()
  storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (itemKey: string) => storage.get(itemKey) ?? null,
      setItem: (itemKey: string, value: string) => { storage.set(itemKey, value) },
      removeItem: (itemKey: string) => { storage.delete(itemKey) },
    },
  })
})

describe('useColonyBootstrap cache', () => {
  it('returns cached data before fresh bootstrap resolves and then updates cache', async () => {
    const cachedPayload = payload('Cached Alpha')
    const freshPayload = payload('Fresh Alpha')
    writeBootstrapCache(COLONY_ID, cachedPayload)
    const pending = createPending<{ ok: boolean; status: number; json: () => Promise<ColonyBootstrapPayload> }>()
    mockFetchWithAuth.mockReturnValue(pending.promise)

    const { useColonyBootstrap } = await import('@/hooks/useColonyBootstrap')
    const { result } = renderHook(() => useColonyBootstrap(COLONY_ID), { wrapper })

    expect(result.current.data?.colony.name).toBe('Cached Alpha')
    expect(result.current.hasCachedData).toBe(true)
    expect(result.current.isStale).toBe(true)
    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalled())

    await act(async () => {
      pending.resolve({ ok: true, status: 200, json: async () => freshPayload })
      await pending.promise
    })

    await waitFor(() => expect(result.current.data?.colony.name).toBe('Fresh Alpha'))
    expect(result.current.isStale).toBe(false)
    expect(readBootstrapCache(COLONY_ID)?.colony.name).toBe('Fresh Alpha')
  })

  it('clears cached bootstrap data after an unauthorized fresh response', async () => {
    writeBootstrapCache(COLONY_ID, payload('Cached Alpha'))
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Not authenticated' } }),
    })

    const { useColonyBootstrap } = await import('@/hooks/useColonyBootstrap')
    const { result } = renderHook(() => useColonyBootstrap(COLONY_ID), { wrapper })

    await waitFor(() => expect(result.current.error).toBe('Not authenticated'))

    expect(readBootstrapCache(COLONY_ID)).toBeNull()
  })

  it('defers full sync until the first canvas milestone', async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload('Fast Alpha') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload('Synced Alpha') })

    const { useColonyBootstrap } = await import('@/hooks/useColonyBootstrap')
    const { result } = renderHook(() => useColonyBootstrap(COLONY_ID), { wrapper })

    await waitFor(() => expect(result.current.data?.colony.name).toBe('Fast Alpha'))
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(1)

    act(() => {
      markLoadMilestone('first-canvas')
    })

    await waitFor(() => expect(result.current.data?.colony.name).toBe('Synced Alpha'))
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/colonies/sync', expect.objectContaining({ method: 'POST' }), { cookieFirst: true })
    expect(readBootstrapCache(COLONY_ID)?.colony.name).toBe('Synced Alpha')
  })
})

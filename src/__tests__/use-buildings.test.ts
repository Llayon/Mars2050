import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBuildings } from '@/hooks/useBuildings'
import type { BuildingRow } from '@/domains/building/building.types'

// Mock supabase
const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// Mock useSubscription to capture and trigger the callback manually
let subscriptionCallback: ((payload: unknown) => void) | null = null
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: (_table: string, _colonyId: string | null, callback: (payload: unknown) => void) => {
    subscriptionCallback = callback
  },
}))

describe('useBuildings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionCallback = null
    global.fetch = vi.fn()
  })

  it('prevents duplicate buildings when fetch and realtime both trigger', async () => {
    const colonyId = 'colony-123'
    const newBuilding = {
      id: 'building-abc',
      colony_id: colonyId,
      type: 'solar_panels',
      name: 'Солнечная панель',
      level: 1,
      is_active: true,
      x: 10,
      y: 10,
    }

    // 1. Mock fetch response for GET buildings (initial fetch)
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    // 2. Render the hook
    let hookResult: { current: ReturnType<typeof useBuildings> } | undefined
    await act(async () => {
      const { result } = renderHook(() => useBuildings(colonyId))
      hookResult = result
    })

    // Expect initial buildings list to be empty
    expect(hookResult!.current.buildings).toEqual([])

    // 3. Mock fetch response for building creation (POST /api/buildings)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ building: newBuilding }),
    })

    // 4. Trigger buildStructure AND simulate realtime event concurrently
    await act(async () => {
      const buildPromise = hookResult!.current.buildStructure('solar_panels', 10, 10)

      // Simulate Realtime subscription receiving the INSERT payload before POST response finishes
      if (subscriptionCallback) {
        subscriptionCallback({
          eventType: 'INSERT',
          new: newBuilding,
        })
      }

      await buildPromise
    })

    // Expect the building to be added exactly ONCE (no duplicates!)
    expect(hookResult!.current.buildings.length).toBe(1)
    expect(hookResult!.current.buildings[0].id).toBe('building-abc')
  })

  it('optimistically updates building settings before PATCH resolves', async () => {
    const colonyId = 'colony-123'
    const existingBuilding: BuildingRow = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      colony_id: colonyId,
      type: 'mine',
      name: 'Mine',
      level: 1,
      is_active: true,
      x: 15,
      y: 15,
      staffing_mode: 'auto',
      assigned_workers: 2,
      work_priority: 'normal',
      paused: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [existingBuilding], error: null }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const { result } = renderHook(() => useBuildings(colonyId))
    await waitFor(() => expect(result.current.buildings).toHaveLength(1))

    let resolveFetch!: (value: Response) => void
    const pendingFetch = new Promise<Response>(resolve => { resolveFetch = resolve })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(pendingFetch)

    let updatePromise: Promise<void>
    act(() => {
      updatePromise = result.current.updateBuildingSettings(existingBuilding.id, { work_priority: 'high' })
    })

    await waitFor(() => {
      expect(result.current.buildings[0].work_priority).toBe('high')
    })

    await act(async () => {
      resolveFetch({ ok: true } as Response)
      await updatePromise
    })
  })
})

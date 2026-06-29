import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBuildings } from '@/hooks/useBuildings'

// Mock supabase
const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// Mock useSubscription to capture and trigger the callback manually
let subscriptionCallback: ((payload: any) => void) | null = null
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: (_table: string, _colonyId: string | null, callback: (payload: any) => void) => {
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
    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useBuildings(colonyId))
      hookResult = result
    })

    // Expect initial buildings list to be empty
    expect(hookResult.current.buildings).toEqual([])

    // 3. Mock fetch response for building creation (POST /api/buildings)
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ building: newBuilding }),
    })

    // 4. Trigger buildStructure AND simulate realtime event concurrently
    await act(async () => {
      const buildPromise = hookResult.current.buildStructure('solar_panels', 10, 10)

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
    expect(hookResult.current.buildings).toHaveLength(1)
    expect(hookResult.current.buildings[0]).toEqual(newBuilding)
  })
})

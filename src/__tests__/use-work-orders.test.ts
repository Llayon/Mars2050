import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import type { WorkOrderRow } from '@/domains/work-order/work-order.types'

interface MockResponse {
  ok: boolean
  json: () => Promise<unknown>
}

interface ChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: unknown
  old: Record<string, unknown>
}

const mockFetchWithAuth = vi.fn<(...args: unknown[]) => Promise<MockResponse>>()

vi.mock('@/lib/fetch-with-auth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}))

let subscriptionCallback: ((payload: ChangePayload) => void) | null = null

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: (_table: string, _colonyId: string | null, callback: (payload: ChangePayload) => void) => {
    subscriptionCallback = callback
  },
}))

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'
const ORDER_ID = '550e8400-e29b-41d4-a716-446655440001'

const baseOrder: WorkOrderRow = {
  id: ORDER_ID,
  colony_id: COLONY_ID,
  type: 'clear_rubble',
  status: 'active',
  assigned_tier: 'worker',
  assigned_slots: 2,
  cost: { energy: 10 },
  reward: { minerals: 80 },
  started_at: '2026-01-01T00:00:00.000Z',
  completes_at: '2026-01-01T00:20:00.000Z',
  claimed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function okResponse(body: unknown): MockResponse {
  return { ok: true, json: async () => body }
}

async function renderLoaded(initialOrders: WorkOrderRow[] = []) {
  mockFetchWithAuth.mockResolvedValueOnce(okResponse({ workOrders: initialOrders }))
  const rendered = renderHook(() => useWorkOrders(COLONY_ID))
  await waitFor(() => expect(rendered.result.current.loading).toBe(false))
  return rendered
}

describe('useWorkOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionCallback = null
  })

  it('loads work orders through the API route', async () => {
    const { result } = await renderLoaded([baseOrder])

    expect(mockFetchWithAuth).toHaveBeenCalledWith(`/api/work-orders?colonyId=${COLONY_ID}`)
    expect(result.current.workOrders).toEqual([baseOrder])
  })

  it('starts a work order and upserts the returned row', async () => {
    const { result } = await renderLoaded()
    mockFetchWithAuth.mockResolvedValueOnce(okResponse({ workOrder: baseOrder }))

    await act(async () => {
      await result.current.startWorkOrder('clear_rubble')
    })

    const [, options] = mockFetchWithAuth.mock.calls[1]
    expect(options).toMatchObject({ method: 'POST' })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      colonyId: COLONY_ID,
      type: 'clear_rubble',
    })
    expect(result.current.workOrders).toEqual([baseOrder])
  })

  it('claims a completed work order through the API route', async () => {
    const completedOrder: WorkOrderRow = { ...baseOrder, status: 'completed' }
    const claimedOrder: WorkOrderRow = { ...completedOrder, status: 'claimed', claimed_at: '2026-01-01T00:30:00.000Z' }
    const { result } = await renderLoaded([completedOrder])
    mockFetchWithAuth.mockResolvedValueOnce(okResponse({ workOrder: claimedOrder }))

    await act(async () => {
      await result.current.claimWorkOrder(ORDER_ID)
    })

    const [, options] = mockFetchWithAuth.mock.calls[1]
    expect(options).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      colonyId: COLONY_ID,
      workOrderId: ORDER_ID,
      action: 'claim',
    })
    expect(result.current.workOrders).toEqual([claimedOrder])
  })

  it('upserts realtime inserts without duplicates', async () => {
    const { result } = await renderLoaded([baseOrder])

    act(() => {
      subscriptionCallback?.({ eventType: 'INSERT', new: baseOrder, old: {} })
    })

    expect(result.current.workOrders).toEqual([baseOrder])
  })
})

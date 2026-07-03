import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WORK_ORDER_TYPES } from '@/domains/work-order/work-order.config'
import type { WorkOrderRow } from '@/domains/work-order/work-order.types'

type DbResult = { data: unknown; error: { message: string } | null }

interface MockQueryBuilder {
  update: (values: Record<string, unknown>) => MockQueryBuilder
  eq: (column: string, value: unknown) => MockQueryBuilder
  lte: (column: string, value: unknown) => Promise<DbResult>
}

const mockUpdate = vi.fn<(values: Record<string, unknown>) => MockQueryBuilder>()
const mockEq = vi.fn<(column: string, value: unknown) => MockQueryBuilder>()
const mockLte = vi.fn<(column: string, value: unknown) => Promise<DbResult>>()
const mockRpc = vi.fn<(...args: unknown[]) => Promise<DbResult>>()
const mockFrom = vi.fn((_table: string) => createQueryBuilder())

function createQueryBuilder(): MockQueryBuilder {
  const queryBuilder: MockQueryBuilder = {
    update: mockUpdate.mockImplementation(() => queryBuilder),
    eq: mockEq.mockImplementation(() => queryBuilder),
    lte: mockLte.mockResolvedValue({ data: [], error: null }),
  }
  return queryBuilder
}

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
}

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => mockSupabase
}))

import { claimWorkOrder, getReservedWorkOrderSlots, startWorkOrder } from '@/domains/work-order/work-order.service'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'
const ORDER_ID = '550e8400-e29b-41d4-a716-446655440001'
const workOrder: WorkOrderRow = {
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
  updated_at: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ data: { success: true, work_order: workOrder }, error: null })
})

describe('work-order service', () => {
  it('sums active reserved slots by population tier', () => {
    const reserved = getReservedWorkOrderSlots([
      workOrder,
      { ...workOrder, id: 'order-2', assigned_slots: 1, assigned_tier: 'technician' },
      { ...workOrder, id: 'order-3', status: 'completed', assigned_slots: 5 },
    ])

    expect(reserved.worker).toBe(2)
    expect(reserved.technician).toBe(1)
    expect(reserved.scientist).toBeUndefined()
  })

  it('starts work orders through the atomic RPC', async () => {
    const result = await startWorkOrder({ colonyId: COLONY_ID, type: 'clear_rubble' })
    const config = WORK_ORDER_TYPES.clear_rubble

    expect(result.workOrder).toEqual(workOrder)
    expect(mockFrom).toHaveBeenCalledWith('work_orders')
    expect(mockRpc).toHaveBeenCalledWith('start_work_order_transaction', {
      p_colony_id: COLONY_ID,
      p_type: 'clear_rubble',
      p_assigned_tier: config.assignedTier,
      p_assigned_slots: config.assignedSlots,
      p_duration_minutes: config.durationMinutes,
      p_cost: config.cost,
      p_reward: config.reward,
    })
  })

  it('claims work orders through the atomic RPC', async () => {
    const result = await claimWorkOrder({ colonyId: COLONY_ID, workOrderId: ORDER_ID, action: 'claim' })

    expect(result.workOrder).toEqual(workOrder)
    expect(mockRpc).toHaveBeenCalledWith('claim_work_order_transaction', {
      p_colony_id: COLONY_ID,
      p_work_order_id: ORDER_ID,
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCheckColonyAuth = vi.fn()
vi.mock('@/domains/colony/colony.ownership', () => ({
  checkColonyAuth: (...args: unknown[]) => mockCheckColonyAuth(...args),
}))

const mockStartWorkOrder = vi.fn()
const mockClaimWorkOrder = vi.fn()
const mockGetWorkOrders = vi.fn()
vi.mock('@/domains/work-order/work-order.service', () => ({
  startWorkOrder: (...args: unknown[]) => mockStartWorkOrder(...args),
  claimWorkOrder: (...args: unknown[]) => mockClaimWorkOrder(...args),
  getWorkOrders: (...args: unknown[]) => mockGetWorkOrders(...args),
}))

import { GET, PATCH, POST } from '@/app/api/work-orders/route'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'
const ORDER_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckColonyAuth.mockResolvedValue({ auth: { userId: 'user-1' }, colony: { id: COLONY_ID } })
  mockGetWorkOrders.mockResolvedValue([])
  mockStartWorkOrder.mockResolvedValue({ workOrder: { id: ORDER_ID }, error: null })
  mockClaimWorkOrder.mockResolvedValue({ workOrder: { id: ORDER_ID, status: 'claimed' }, error: null })
})

describe('/api/work-orders', () => {
  it('lists work orders for an owned colony', async () => {
    const req = new NextRequest(`http://localhost/api/work-orders?colonyId=${COLONY_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCheckColonyAuth).toHaveBeenCalledWith(req, COLONY_ID)
    expect(mockGetWorkOrders).toHaveBeenCalledWith(COLONY_ID)
  })

  it('starts a work order for an owned colony', async () => {
    const req = new NextRequest('http://localhost/api/work-orders', {
      method: 'POST',
      body: JSON.stringify({ colonyId: COLONY_ID, type: 'clear_rubble' })
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(mockStartWorkOrder).toHaveBeenCalledWith({ colonyId: COLONY_ID, type: 'clear_rubble' })
  })

  it('claims a work order for an owned colony', async () => {
    const req = new NextRequest('http://localhost/api/work-orders', {
      method: 'PATCH',
      body: JSON.stringify({ colonyId: COLONY_ID, workOrderId: ORDER_ID, action: 'claim' })
    })

    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(mockClaimWorkOrder).toHaveBeenCalledWith({ colonyId: COLONY_ID, workOrderId: ORDER_ID, action: 'claim' })
  })
})

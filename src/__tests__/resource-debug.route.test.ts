import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCheckColonyAuth = vi.fn()
vi.mock('@/domains/colony/colony.ownership', () => ({
  checkColonyAuth: (...args: unknown[]) => mockCheckColonyAuth(...args),
}))

const mockGetEconomyDebugBreakdown = vi.fn()
vi.mock('@/domains/resource/resource.debug', () => ({
  getEconomyDebugBreakdown: (...args: unknown[]) => mockGetEconomyDebugBreakdown(...args),
}))

import { GET } from '@/app/api/resources/debug/route'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckColonyAuth.mockResolvedValue({ auth: { userId: 'user-1' }, colony: { id: COLONY_ID } })
  mockGetEconomyDebugBreakdown.mockResolvedValue({
    elapsedHours: 0,
    production: {},
    consumption: {},
    net: {},
    buildings: [],
    scarcity: {},
    populationConsumption: {},
    populationNeeds: [],
    recommendations: [],
    armyUpkeep: {},
    reservedWorkOrderSlots: {},
  })
})

describe('/api/resources/debug', () => {
  it('returns economy breakdown for an owned colony', async () => {
    const req = new NextRequest(`http://localhost/api/resources/debug?colonyId=${COLONY_ID}`)
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockCheckColonyAuth).toHaveBeenCalledWith(req, COLONY_ID)
    expect(mockGetEconomyDebugBreakdown).toHaveBeenCalledWith(COLONY_ID)
    expect(data.breakdown).toEqual(expect.objectContaining({ buildings: [], scarcity: {} }))
  })

  it('rejects invalid colony IDs before auth', async () => {
    const req = new NextRequest('http://localhost/api/resources/debug?colonyId=bad')
    const res = await GET(req)

    expect(res.status).toBe(422)
    expect(mockCheckColonyAuth).not.toHaveBeenCalled()
  })
})

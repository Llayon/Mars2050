import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

const mockUpgradePopulation = vi.fn()
vi.mock('@/domains/population/population.service', () => ({
  upgradePopulation: (...args: unknown[]) => mockUpgradePopulation(...args),
}))

const mockLoadOwnedColony = vi.fn()
vi.mock('@/domains/colony/colony.ownership', () => ({
  loadOwnedColony: (...args: unknown[]) => mockLoadOwnedColony(...args),
  checkColonyAuth: async (req: Request, colonyId: string) => {
    const auth = await mockGetAuthContext(req)
    if (!auth) return { errorResponse: new Response(null, { status: 401 }) }
    const { colony, error } = await mockLoadOwnedColony(auth.client, auth.userId, colonyId)
    if (error || !colony) return { errorResponse: new Response(null, { status: 403 }) }
    return { auth, colony }
  }
}))

import { POST } from '@/app/api/population/upgrade/route'

const UUID_COLONY = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/population/upgrade', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/population/upgrade', {
      method: 'POST',
      body: JSON.stringify({ colonyId: UUID_COLONY, fromTier: 'worker', count: 1 })
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockUpgradePopulation).not.toHaveBeenCalled()
  })

  it('verifies colony ownership and calls upgradePopulation', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'user-1',
      client: {}
    })
    mockLoadOwnedColony.mockResolvedValue({ colony: { id: UUID_COLONY, user_id: 'user-1' }, error: null })
    mockUpgradePopulation.mockResolvedValue({ data: { success: true } })

    const req = new NextRequest('http://localhost/api/population/upgrade', {
      method: 'POST',
      body: JSON.stringify({ colonyId: UUID_COLONY, fromTier: 'worker', count: 1 })
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpgradePopulation).toHaveBeenCalledWith('user-1', UUID_COLONY, 'worker', 1)
  })
})

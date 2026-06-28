import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

const mockCreateBuilding = vi.fn()
const mockDeleteBuilding = vi.fn()
const mockGetBuildings = vi.fn()
const mockVerifyBuildingOwnership = vi.fn()
vi.mock('@/domains/building/building.service', () => ({
  createBuilding: (...args: unknown[]) => mockCreateBuilding(...args),
  deleteBuilding: (...args: unknown[]) => mockDeleteBuilding(...args),
  getBuildings: (...args: unknown[]) => mockGetBuildings(...args),
  verifyBuildingOwnership: (...args: unknown[]) => mockVerifyBuildingOwnership(...args)
}))

const mockRecalculateResources = vi.fn()
vi.mock('@/domains/resource/resource.service', () => ({
  recalculateResources: (...args: unknown[]) => mockRecalculateResources(...args),
}))

const mockLoadOwnedColony = vi.fn()
const mockMaybeSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

const mockAuthClient = {
  from: mockFrom
}

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

import { GET, POST, DELETE } from '@/app/api/buildings/route'

const UUID_COLONY = '550e8400-e29b-41d4-a716-446655440000'
const UUID_BUILDING = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Buildings API route', () => {
  describe('POST /api/buildings', () => {
    it('returns 403 when trying to build in another user\'s colony', async () => {
      mockGetAuthContext.mockResolvedValue({
        userId: 'user-1',
        client: mockAuthClient
      })
      mockLoadOwnedColony.mockResolvedValue({ colony: null, error: 'Forbidden' })

      const req = new NextRequest('http://localhost/api/buildings', {
        method: 'POST',
        body: JSON.stringify({
          colonyId: UUID_COLONY,
          type: 'solar_panels',
          name: 'Panel 1',
          x: 10,
          y: 10
        })
      })

      const res = await POST(req)
      expect(res.status).toBe(403)
      expect(mockCreateBuilding).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/buildings', () => {
    it('returns 403 when deleting a building that does not belong to specified colony or user', async () => {
      mockGetAuthContext.mockResolvedValue({
        userId: 'user-1',
        client: mockAuthClient
      })
      mockLoadOwnedColony.mockResolvedValue({ colony: { id: UUID_COLONY, user_id: 'user-1' }, error: null })
      
      // Mock building belonging to a different colony or select failing
      mockVerifyBuildingOwnership.mockResolvedValue(false)

      const req = new NextRequest(`http://localhost/api/buildings?buildingId=${UUID_BUILDING}&colonyId=${UUID_COLONY}`, {
        method: 'DELETE'
      })

      const res = await DELETE(req)
      expect(res.status).toBe(403)
      expect(mockDeleteBuilding).not.toHaveBeenCalled()
    })
  })
})

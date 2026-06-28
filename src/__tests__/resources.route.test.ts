import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

const mockRecalculateResources = vi.fn()
vi.mock('@/domains/resource/resource.service', () => ({
  recalculateResources: (...args: unknown[]) => mockRecalculateResources(...args),
}))

const mockLoadOwnedColony = vi.fn()
vi.mock('@/domains/colony/colony.ownership', () => ({
  loadOwnedColony: (...args: unknown[]) => mockLoadOwnedColony(...args),
  checkColonyAuth: async (req: Request, colonyId: string) => {
    const auth = await mockGetAuthContext(req)
    if (!auth) return { errorResponse: { status: 401 } as any }
    const { colony, error } = await mockLoadOwnedColony(auth.client, auth.userId, colonyId)
    if (error || !colony) return { errorResponse: { status: 403 } as any }
    return { auth, colony }
  }
}))

import { GET } from '@/app/api/resources/route'

const UUID_COLONY = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(colonyId: string | null): NextRequest {
  const url = colonyId ? `http://localhost/api/resources?colonyId=${colonyId}` : 'http://localhost/api/resources'
  return new NextRequest(url, { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/resources', () => {
  it('returns 400 if colonyId is missing', async () => {
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const res = await GET(makeRequest(UUID_COLONY))
    expect(res.status).toBe(401)
  })

  it('returns 403 when colony does not belong to user', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'user-1',
      client: {}
    })
    mockLoadOwnedColony.mockResolvedValue({ colony: null, error: 'Forbidden' })
    const res = await GET(makeRequest(UUID_COLONY))
    expect(res.status).toBe(403)
  })

  it('returns 200 and resources when colony belongs to user', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'user-1',
      client: {}
    })
    mockLoadOwnedColony.mockResolvedValue({ colony: { id: UUID_COLONY, user_id: 'user-1' }, error: null })
    mockRecalculateResources.mockResolvedValue([{ type: 'minerals', amount: 100 }])
    
    const res = await GET(makeRequest(UUID_COLONY))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.resources).toBeDefined()
  })
})

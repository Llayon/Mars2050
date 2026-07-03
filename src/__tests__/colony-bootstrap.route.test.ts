import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCheckColonyAuth = vi.fn()
vi.mock('@/domains/colony/colony.ownership', () => ({
  checkColonyAuth: (...args: unknown[]) => mockCheckColonyAuth(...args),
}))

const mockGetColonyBootstrapData = vi.fn()
vi.mock('@/domains/colony/colony.service', () => ({
  getColonyBootstrapData: (...args: unknown[]) => mockGetColonyBootstrapData(...args),
}))

import { GET } from '@/app/api/colonies/bootstrap/route'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckColonyAuth.mockResolvedValue({ auth: { userId: 'user-1' }, colony: { id: COLONY_ID } })
  mockGetColonyBootstrapData.mockResolvedValue({
    data: {
      colony: { id: COLONY_ID, name: 'Mars Base', level: 1, experience: 0, user_id: 'user-1', last_calc_at: '', created_at: '' },
      resources: [],
      buildings: [],
      population: null,
    }
  })
})

describe('/api/colonies/bootstrap', () => {
  it('returns initial colony payload for an owned colony', async () => {
    const req = new NextRequest(`http://localhost/api/colonies/bootstrap?colonyId=${COLONY_ID}`)
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockCheckColonyAuth).toHaveBeenCalledWith(req, COLONY_ID)
    expect(mockGetColonyBootstrapData).toHaveBeenCalledWith(COLONY_ID)
    expect(data.colony.id).toBe(COLONY_ID)
    expect(data.resources).toEqual([])
    expect(data.buildings).toEqual([])
  })

  it('rejects invalid colony IDs before auth', async () => {
    const req = new NextRequest('http://localhost/api/colonies/bootstrap?colonyId=bad')
    const res = await GET(req)

    expect(res.status).toBe(422)
    expect(mockCheckColonyAuth).not.toHaveBeenCalled()
    expect(mockGetColonyBootstrapData).not.toHaveBeenCalled()
  })

  it('does not load bootstrap data for forbidden colonies', async () => {
    mockCheckColonyAuth.mockResolvedValue({ errorResponse: new Response(null, { status: 403 }) })

    const req = new NextRequest(`http://localhost/api/colonies/bootstrap?colonyId=${COLONY_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
    expect(mockGetColonyBootstrapData).not.toHaveBeenCalled()
  })
})

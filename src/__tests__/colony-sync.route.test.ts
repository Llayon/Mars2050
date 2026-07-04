import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockCheckColonyAuth = vi.fn()
const mockGetColonyBootstrapData = vi.fn()

vi.mock('@/domains/colony/colony.ownership', () => ({
  checkColonyAuth: (...args: unknown[]) => mockCheckColonyAuth(...args),
}))

vi.mock('@/domains/colony/colony.service', () => ({
  getColonyBootstrapData: (...args: unknown[]) => mockGetColonyBootstrapData(...args),
}))

import { POST } from '@/app/api/colonies/sync/route'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/colonies/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckColonyAuth.mockResolvedValue({ auth: { userId: 'user-1' }, colony: { id: COLONY_ID } })
  mockGetColonyBootstrapData.mockResolvedValue({
    data: {
      colony: { id: COLONY_ID, name: 'Mars Base', level: 1, experience: 0, user_id: 'user-1', last_calc_at: '', created_at: '' },
      resources: [{ type: 'minerals', amount: 100 }],
      buildings: [],
      population: null,
    }
  })
})

describe('/api/colonies/sync', () => {
  it('runs full colony sync for an owned colony', async () => {
    const req = request({ colonyId: COLONY_ID })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockCheckColonyAuth).toHaveBeenCalledWith(req, COLONY_ID)
    expect(mockGetColonyBootstrapData).toHaveBeenCalledWith(COLONY_ID)
    expect(data.resources).toEqual([{ type: 'minerals', amount: 100 }])
  })

  it('rejects invalid colony IDs before auth', async () => {
    const res = await POST(request({ colonyId: 'bad' }))

    expect(res.status).toBe(422)
    expect(mockCheckColonyAuth).not.toHaveBeenCalled()
    expect(mockGetColonyBootstrapData).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON before auth', async () => {
    const req = new NextRequest('http://localhost/api/colonies/sync', { method: 'POST', body: '' })
    const res = await POST(req)

    expect(res.status).toBe(422)
    expect(mockCheckColonyAuth).not.toHaveBeenCalled()
    expect(mockGetColonyBootstrapData).not.toHaveBeenCalled()
  })

  it('does not sync forbidden colonies', async () => {
    mockCheckColonyAuth.mockResolvedValue({ errorResponse: new Response(null, { status: 403 }) })

    const res = await POST(request({ colonyId: COLONY_ID }))

    expect(res.status).toBe(403)
    expect(mockGetColonyBootstrapData).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @/lib/auth before importing the route.
const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

// Mock the service to inspect what args it received.
const mockExecuteAttack = vi.fn()
const mockExecuteTrade = vi.fn()
vi.mock('@/domains/pvp/pvp.service', () => ({
  executeAttack: (...args: unknown[]) => mockExecuteAttack(...args),
  executeTrade: (...args: unknown[]) => mockExecuteTrade(...args),
}))

import { POST as attackPOST } from '@/app/api/pvp/attack/route'
import { POST as tradePOST } from '@/app/api/pvp/trade/route'

const UUID_A = '550e8400-e29b-41d4-a716-446655440000'
const UUID_B = '550e8400-e29b-41d4-a716-446655440001'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pvp/attack', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/pvp/attack — auth guard', () => {
  it('returns 401 when no auth context', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const res = await attackPOST(makeRequest({ defenderColonyId: UUID_B }))
    expect(res.status).toBe(401)
    expect(mockExecuteAttack).not.toHaveBeenCalled()
  })

  it('forwards userId and auth client to the service', async () => {
    const fakeAuth = {
      userId: 'user-1',
      email: 'x@y',
      client: { from: vi.fn() },
    }
    mockGetAuthContext.mockResolvedValue(fakeAuth)
    mockExecuteAttack.mockResolvedValue({
      success: true,
      message: 'ok',
      battleId: 'battle-1',
    })

    const res = await attackPOST(
      makeRequest({ attackerColonyId: UUID_A, defenderColonyId: UUID_B, clientSeed: 42 })
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockExecuteAttack).toHaveBeenCalledTimes(1)
    const call = mockExecuteAttack.mock.calls[0]!
    // [authClient, userId, attackerColonyId, defenderColonyId, clientSeed, placement]
    expect(call[1]).toBe('user-1')
    expect(call[2]).toBe(UUID_A)
    expect(call[3]).toBe(UUID_B)
    expect(call[4]).toBe(42)
  })

  it('rejects malformed body with 422', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'user-1', email: null, client: {} as never })
    const res = await attackPOST(makeRequest({ defenderColonyId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
    expect(mockExecuteAttack).not.toHaveBeenCalled()
  })
})

describe('POST /api/pvp/trade — auth guard', () => {
  it('returns 401 when no auth context', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const res = await tradePOST(
      makeRequest({ toColonyId: UUID_B, offerResources: { energy: 10 } })
    )
    expect(res.status).toBe(401)
  })

  it('forwards userId to the service', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'user-2',
      email: null,
      client: {} as never,
    })
    mockExecuteTrade.mockResolvedValue({ success: true, message: 'ok' })
    const res = await tradePOST(
      makeRequest({
        fromColonyId: UUID_A,
        toColonyId: UUID_B,
        offerResources: { energy: 5 },
      })
    )
    expect(res.status).toBe(200)
    const call = mockExecuteTrade.mock.calls[0]!
    // [authClient, userId, fromColonyId, toColonyId, offer, request]
    expect(call[1]).toBe('user-2')
    expect(call[2]).toBe(UUID_A)
  })
})

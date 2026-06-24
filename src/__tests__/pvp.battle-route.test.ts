import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

const mockLoadAuthorizedBattle = vi.fn()
vi.mock('@/domains/pvp/pvp.replay', () => ({
  loadAuthorizedBattle: (...args: unknown[]) => mockLoadAuthorizedBattle(...args),
  loadBattleWithSnapshot: vi.fn(),
  persistBattleWithSnapshot: vi.fn(),
  getAttackCooldownSeconds: vi.fn().mockResolvedValue(0),
}))

import { GET } from '@/app/api/pvp/battle/[battleId]/route'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pvp/battle/:battleId', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when battle does not exist', async () => {
    mockLoadAuthorizedBattle.mockResolvedValueOnce(null)
    mockGetAuthContext.mockResolvedValue({
      userId: 'u',
      email: null,
      client: { from: vi.fn() } as never,
    })

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is not a participant', async () => {
    mockLoadAuthorizedBattle.mockResolvedValueOnce(null)
    mockGetAuthContext.mockResolvedValue({
      userId: 'me',
      email: null,
      client: { from: vi.fn() } as never,
    })

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(403)
  })

  it('returns the battle and snapshot when user participates', async () => {
    const battle = {
      id: UUID,
      attacker_colony_id: 'col-a',
      defender_colony_id: 'col-b',
      winner: 'attacker',
      rewards: {},
      created_at: '2026-01-01',
    }
    const snapshot = {
      battle_id: UUID,
      seed: 42,
      initial_state: { units: [] },
      log: [],
      version: 1,
      created_at: '2026-01-01',
    }
    mockLoadAuthorizedBattle.mockResolvedValueOnce({ battle, snapshot })
    mockGetAuthContext.mockResolvedValue({
      userId: 'me',
      email: null,
      client: { from: vi.fn() } as never,
    })

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.battle.id).toBe(UUID)
    expect(data.snapshot.seed).toBe(42)
  })

  it('rejects malformed battle id with 422', async () => {
    mockGetAuthContext.mockResolvedValue({
      userId: 'u',
      email: null,
      client: { from: vi.fn() } as never,
    })
    const res = await GET(
      new NextRequest('http://localhost/api/pvp/battle/not-a-uuid'),
      { params: Promise.resolve({ battleId: 'not-a-uuid' }) }
    )
    expect(res.status).toBe(422)
  })
})


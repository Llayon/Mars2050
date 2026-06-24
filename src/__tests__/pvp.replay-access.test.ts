import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadAuthorizedBattle = vi.fn()
vi.mock('@/domains/pvp/pvp.replay', () => ({
  loadAuthorizedBattle: (...args: unknown[]) => mockLoadAuthorizedBattle(...args),
}))

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

import { GET } from '@/app/api/pvp/battle/[battleId]/route'
import { NextRequest } from 'next/server'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pvp/battle/[battleId] — replay access contract', () => {
  it('returns 401 when caller is unauthenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null)
    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(401)
    expect(mockLoadAuthorizedBattle).not.toHaveBeenCalled()
  })

  it('returns 422 for malformed battle id', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u', email: null, client: {} as never })
    const res = await GET(
      new NextRequest('http://localhost/api/pvp/battle/not-a-uuid'),
      { params: Promise.resolve({ battleId: 'not-a-uuid' }) }
    )
    expect(res.status).toBe(422)
  })

  it('returns 403 when user is not a participant (battle exists but invisible)', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'me', email: null, client: {} as never })
    mockLoadAuthorizedBattle.mockResolvedValue(null)

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 with snapshot when user participates', async () => {
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
      seed: 12345,
      initial_state: { units: [] },
      log: [{ tick: 0, actions: [] }],
      version: 1,
      created_at: '2026-01-01',
    }
    mockGetAuthContext.mockResolvedValue({ userId: 'me', email: null, client: {} as never })
    mockLoadAuthorizedBattle.mockResolvedValue({ battle, snapshot })

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.battle.id).toBe(UUID)
    expect(data.snapshot.seed).toBe(12345)
    expect(data.snapshot.version).toBe(1)
  })

  it('does not expose snapshot to non-participants', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'me', email: null, client: {} as never })
    mockLoadAuthorizedBattle.mockResolvedValue(null)

    const res = await GET(
      new NextRequest(`http://localhost/api/pvp/battle/${UUID}`),
      { params: Promise.resolve({ battleId: UUID }) }
    )
    const data = await res.json()
    expect(data.snapshot).toBeUndefined()
    expect(data.battle).toBeUndefined()
  })
})

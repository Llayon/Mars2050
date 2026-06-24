import { describe, it, expect, vi } from 'vitest'

const fromMock = vi.fn()
const getServerClientMock = vi.fn(() => ({ from: fromMock }))
vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => getServerClientMock(),
}))

import { loadBattleWithSnapshot, persistBattleWithSnapshot, SNAPSHOT_VERSION } from '@/domains/pvp/pvp.replay'

function chainable(result: unknown) {
  const c: Record<string, unknown> = {}
  const self = c
  c.select = vi.fn(() => self)
  c.eq = vi.fn(() => self)
  c.insert = vi.fn(() => self)
  c.single = vi.fn(() => Promise.resolve(result))
  c.then = (resolve: (v: unknown) => void) => resolve(result)
  return c
}

describe('pvp.replay — snapshot version contract', () => {
  it('SNAPSHOT_VERSION is a positive integer', () => {
    expect(typeof SNAPSHOT_VERSION).toBe('number')
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(SNAPSHOT_VERSION)).toBe(true)
  })

  it('loadBattleWithSnapshot returns the stored version unchanged', async () => {
    const battle = {
      id: 'b1', attacker_colony_id: 'a', defender_colony_id: 'd',
      winner: 'attacker', rewards: {}, created_at: '2026-01-01',
    }
    const snapshot = {
      battle_id: 'b1', seed: 1, initial_state: {}, log: [],
      version: 7, created_at: '2026-01-01',
    }
    fromMock
      .mockImplementationOnce(() => chainable({ data: battle, error: null }))
      .mockImplementationOnce(() => chainable({ data: snapshot, error: null }))

    const r = await loadBattleWithSnapshot('b1')
    expect(r).not.toBeNull()
    expect(r?.snapshot.version).toBe(7)
  })

  it('persistBattleWithSnapshot returns the inserted battle id', async () => {
    fromMock
      .mockImplementationOnce(() => chainable({ data: { id: 'b2' }, error: null }))
      .mockImplementationOnce(() => chainable({ data: null, error: null }))

    const id = await persistBattleWithSnapshot(
      {
        attacker_colony_id: 'a', defender_colony_id: 'd', winner: 'draw',
        attacker_units: {}, defender_units: {}, rewards: {},
      },
      { seed: 0, initial_state: {}, log: {} }
    )
    expect(id).toBe('b2')
  })

  it('persistBattleWithSnapshot returns null when battle insert fails', async () => {
    fromMock.mockImplementationOnce(() =>
      chainable({ data: null, error: { message: 'insert failed' } })
    )

    const id = await persistBattleWithSnapshot(
      {
        attacker_colony_id: 'a', defender_colony_id: 'd', winner: 'attacker',
        attacker_units: {}, defender_units: {}, rewards: {},
      },
      { seed: 0, initial_state: {}, log: {}, simulationVersion: 99 }
    )
    expect(id).toBeNull()
  })
})

import { beforeEach, describe, it, expect, vi } from 'vitest'

const fromMock = vi.fn()
const getServerClientMock = vi.fn(() => ({ from: fromMock }))
vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => getServerClientMock(),
}))

import { loadBattleWithSnapshot, persistBattleWithSnapshot, SNAPSHOT_VERSION } from '@/domains/pvp/pvp.replay'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'

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
  beforeEach(() => {
    fromMock.mockReset()
  })

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
      metrics: { firstAttackTick: 3, engineRevision: CURRENT_SIMULATION_REVISION },
      version: CURRENT_SIMULATION_VERSION, created_at: '2026-01-01',
    }
    fromMock
      .mockImplementationOnce(() => chainable({ data: battle, error: null }))
      .mockImplementationOnce(() => chainable({ data: snapshot, error: null }))

    const r = await loadBattleWithSnapshot('b1')
    expect(r).not.toBeNull()
    expect(r?.snapshot.version).toBe(CURRENT_SIMULATION_VERSION)
    expect(r?.snapshot.metrics).toEqual({ firstAttackTick: 3, engineRevision: CURRENT_SIMULATION_REVISION })
    expect(r?.compatibility).toMatchObject({
      status: 'current',
      canPlay: true,
    })
  })

  it('persistBattleWithSnapshot returns the inserted battle id', async () => {
    const snapshotInsert = vi.fn()
    fromMock
      .mockImplementationOnce(() => chainable({ data: { id: 'b2' }, error: null }))
      .mockImplementationOnce(() => {
        const chain = chainable({ data: null, error: null })
        chain.insert = snapshotInsert.mockImplementation(() => chain)
        return chain
      })

    const id = await persistBattleWithSnapshot(
      {
        attacker_colony_id: 'a', defender_colony_id: 'd', winner: 'draw',
        attacker_units: {}, defender_units: {}, rewards: {},
      },
      {
        seed: 0,
        initial_state: {},
        log: {},
        metrics: { averageOverlapRatio: 0.25 },
        simulationVersion: CURRENT_SIMULATION_VERSION,
        simulationRevision: CURRENT_SIMULATION_REVISION,
      }
    )
    expect(id).toBe('b2')
    expect(snapshotInsert).toHaveBeenCalledWith(expect.objectContaining({
      metrics: expect.objectContaining({ averageOverlapRatio: 0.25, engineRevision: CURRENT_SIMULATION_REVISION }),
    }))
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
      { seed: 0, initial_state: {}, log: {}, simulationVersion: 99, simulationRevision: CURRENT_SIMULATION_REVISION }
    )
    expect(id).toBeNull()
  })

  it('rejects persistence when the producer version is missing', async () => {
    const id = await persistBattleWithSnapshot(
      {
        attacker_colony_id: 'a', defender_colony_id: 'd', winner: 'draw',
        attacker_units: {}, defender_units: {}, rewards: {},
      },
      { seed: 0, initial_state: {}, log: {}, simulationRevision: CURRENT_SIMULATION_REVISION },
    )

    expect(id).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects persistence when the producer revision is missing', async () => {
    const id = await persistBattleWithSnapshot(
      {
        attacker_colony_id: 'a', defender_colony_id: 'd', winner: 'draw',
        attacker_units: {}, defender_units: {}, rewards: {},
      },
      { seed: 0, initial_state: {}, log: {}, simulationVersion: CURRENT_SIMULATION_VERSION },
    )

    expect(id).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

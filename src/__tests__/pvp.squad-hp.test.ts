import { describe, it, expect } from 'vitest'
import { aggregateSquadHp } from '@/domains/pvp/pvp.persistence'

describe('pvp.service: aggregateSquadHp', () => {
  it('returns null when no squad members present', () => {
    const r = aggregateSquadHp('u1', [
      { id: 'u2_0', hp: 5, maxHp: 10 },
    ])
    expect(r).toBeNull()
  })

  it('averages the hp ratio across squad members', () => {
    // survivors: u1_0 with 10/10, u1_1 with 0/10 → ratio 0.5 → 50% of maxHp
    const r = aggregateSquadHp('u1', [
      { id: 'u1_0', hp: 10, maxHp: 10 },
      { id: 'u1_1', hp: 0, maxHp: 10 },
    ])
    expect(r).toEqual({ hp_current: 5 })
  })

  it('caps the result at maxHp of the first survivor', () => {
    // If all survivors are at full HP, the result must not exceed the maxHp.
    const r = aggregateSquadHp('u1', [
      { id: 'u1_0', hp: 30, maxHp: 30 },
      { id: 'u1_1', hp: 30, maxHp: 30 },
    ])
    expect(r?.hp_current).toBeLessThanOrEqual(30)
  })

  it('clamps to a minimum of 1 when every squad member is at zero HP', () => {
    const r = aggregateSquadHp('u1', [
      { id: 'u1_0', hp: 0, maxHp: 20 },
      { id: 'u1_1', hp: 0, maxHp: 20 },
    ])
    expect(r?.hp_current).toBe(1)
  })
})

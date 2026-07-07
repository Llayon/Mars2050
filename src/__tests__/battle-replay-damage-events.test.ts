import { describe, expect, it } from 'vitest'
import { hasDetailedDamageEvents, isDetailedDamageAction } from '@/components/game/battle-replay-damage-events'
import type { BattleTick } from '@/domains/combat/combat.types'

describe('battle replay damage events', () => {
  it('keeps old attack-only logs in legacy HP mode', () => {
    const logs: BattleTick[] = [
      { tick: 0, actions: [{ unitId: 'a', type: 'attack', targetId: 'b', damage: 10 }] },
    ]

    expect(hasDetailedDamageEvents(logs)).toBe(false)
  })

  it('detects detailed damage logs', () => {
    const logs: BattleTick[] = [
      { tick: 0, actions: [{ unitId: 'a', type: 'damage', targetId: 'b', damage: 10 }] },
    ]

    expect(hasDetailedDamageEvents(logs)).toBe(true)
  })

  it('classifies every detailed damage action type', () => {
    expect(isDetailedDamageAction('damage')).toBe(true)
    expect(isDetailedDamageAction('damage_share')).toBe(true)
    expect(isDetailedDamageAction('shield_damage')).toBe(true)
    expect(isDetailedDamageAction('shield_break')).toBe(true)
    expect(isDetailedDamageAction('shield_hit_block')).toBe(true)
    expect(isDetailedDamageAction('lifesteal')).toBe(true)
    expect(isDetailedDamageAction('unit_blocked_damage')).toBe(true)
    expect(isDetailedDamageAction('barrier_absorb')).toBe(true)
    expect(isDetailedDamageAction('attack')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

describe('shield hit block primitive', () => {
  it('fully blocks the first shield overflow hit and then falls back to numeric shield rules', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'shielded', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
    })!
    const world = new CombatWorld([attacker, target])
    world.stores.combat.require(1).defense = 0
    Object.assign(world.stores.vitality.require(1), {
      hp: 100, maxHp: 100, shield: 20, maxShield: 20,
    })
    world.stores.defense.require(1).shieldHitBlockCharges = 1
    const actions: BattleAction[] = []

    const first = applyEcsSingleDamage(world, 0, 1, 80, actions)

    expect(first).toMatchObject({ damage: 0, shieldDamage: 20, shieldBroken: true, shieldHitBlock: true, shieldHitBlockedDamage: 60 })
    expect(world.stores.vitality.require(1).hp).toBe(100)
    expect(world.stores.defense.require(1).shieldHitBlockCharges).toBe(0)
    expect(actions).toEqual([
      { unitId: 'shielded', type: 'unit_blocked_damage', targetId: 'attacker', damage: 60 },
      { unitId: 'shielded', type: 'shield_hit_block', targetId: 'attacker', damage: 60 },
      { unitId: 'attacker', type: 'shield_damage', targetId: 'shielded', damage: 20, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'shielded' },
    ])

    Object.assign(world.stores.vitality.require(1), { shield: 20, maxShield: 20 })
    actions.length = 0
    const second = applyEcsSingleDamage(world, 0, 1, 80, actions)

    expect(second).toMatchObject({ damage: 60, shieldDamage: 20, shieldBroken: true, shieldHitBlock: false })
    expect(world.stores.vitality.require(1).hp).toBe(40)
    expect(actions.some(action => action.type === 'shield_hit_block')).toBe(false)
  })
})

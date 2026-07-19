import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import {
  applyEcsPrimaryDamageModifiers,
  applyEcsSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'

describe('combat ECS primary damage modifiers', () => {
  it('spends movement charge through the native single-shot path', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'buggy',
      team: 'attacker',
      type: 'scavenger_buggy',
      x: 10,
      y: 20,
      currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([attacker, target])
    world.stores.targeting.require(0).chargeDistance = 180
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(1),
      tick: 0,
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.targeting.require(0).chargeDistance).toBe(0)
    expect(world.stores.vitality.require(1).hp).toBe(4)
    expect(actions).toEqual([
      { unitId: 'buggy', type: 'attack', targetId: 'target' },
      { unitId: 'buggy', type: 'charge_damage', targetId: 'target', value: 2.2 },
      { unitId: 'target', type: 'unit_blocked_damage', targetId: 'buggy', damage: 2 },
      { unitId: 'buggy', type: 'damage', targetId: 'target', damage: 31 },
    ])
  })

  it('tracks ramp focus with an EntityId reference', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'ion',
      team: 'attacker',
      type: 'ion_crawler',
      x: 10,
      y: 20,
      currentAngle: 0,
    })!
    const first = createRuntimeUnitFromConfig({
      id: 'first',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const second = createRuntimeUnitFromConfig({
      id: 'second',
      team: 'defender',
      type: 'marine',
      x: 120,
      y: 20,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([attacker, first, second])
    const actions: Parameters<typeof applyEcsPrimaryDamageModifiers>[4] = []

    expect(applyEcsPrimaryDamageModifiers(world, 0, 1, 10, actions)).toBe(10)
    expect(applyEcsPrimaryDamageModifiers(world, 0, 1, 10, actions)).toBe(12)
    expect(applyEcsPrimaryDamageModifiers(world, 0, 2, 10, actions)).toBe(10)

    expect(world.stores.entityTargets.require(0).rampTarget).toBe(2)
    expect(world.stores.targeting.require(0)).toMatchObject({
      rampTargetId: 'second',
      rampMultiplier: 1,
    })
    expect(actions.map(action => action.value)).toEqual([1, 1.25, 1])
  })

  it('adds capped percent-HP damage before mitigation', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'railgun',
      team: 'attacker',
      type: 'railgun_walker',
      x: 10,
      y: 20,
      currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([attacker, target])
    Object.assign(world.stores.vitality.require(1), { hp: 2_000, maxHp: 2_000 })
    world.stores.combat.require(1).defense = 0
    const actions: Parameters<typeof applyEcsSingleDamage>[4] = []

    applyEcsSingleDamage(world, 0, 1, attacker.attack, actions)

    expect(world.stores.vitality.require(1).hp).toBe(1_790)
    expect(actions).toEqual([
      { unitId: 'railgun', type: 'percent_hp_damage', targetId: 'target', value: 90 },
      { unitId: 'railgun', type: 'damage', targetId: 'target', damage: 210 },
    ])
  })
})

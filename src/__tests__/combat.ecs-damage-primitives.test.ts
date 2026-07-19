import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

describe('combat ECS multi-entity damage primitives', () => {
  it('intercepts eligible ECS projectiles and assigns cooldown', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'missile_buggy', x: 10, y: 20, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    const emitter = createRuntimeUnitFromConfig({ id: 'emitter', team: 'defender', type: 'shield_emitter', x: 120, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([attacker, target, emitter])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)
    const actions: Parameters<typeof applyEcsSingleDamage>[4] = []

    applyEcsSingleDamage(world, 0, 1, attacker.attack, actions)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
    expect(world.stores.defense.require(2).projectileInterceptCooldown).toBe(12)
    expect(actions).toEqual([expect.objectContaining({
      unitId: 'emitter',
      type: 'projectile_intercept',
      targetId: 'target',
      damage: attacker.attack,
    })])
  })

  it('consumes finite ECS barriers before target HP', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    attacker.attack = 100
    const world = new CombatWorld([attacker, target])
    world.queueHazardCreation({
      id: 'barrier',
      sourceUnitId: 'emitter',
      team: 'defender',
      type: 'barrier_dome',
      x: 100,
      y: 20,
      radius: 100,
      damagePerTick: 0,
      duration: 10,
      capacity: 30,
      maxCapacity: 30,
    })
    world.flushStructuralCommands()
    const actions: Parameters<typeof applyEcsSingleDamage>[4] = []

    applyEcsSingleDamage(world, 0, 1, attacker.attack, actions)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp - 68)
    expect(world.getHazard(world.getEntityId('barrier')!)).toMatchObject({ capacity: 0, duration: 0 })
    expect(actions.map(action => action.type)).toEqual([
      'unit_blocked_damage',
      'barrier_absorb',
      'barrier_break',
      'damage',
    ])
  })

  it('shares ECS damage deterministically between nearby allies', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    const allyA = createRuntimeUnitFromConfig({ id: 'ally-a', team: 'defender', type: 'marine', x: 110, y: 20, currentAngle: Math.PI })!
    const allyB = createRuntimeUnitFromConfig({ id: 'ally-b', team: 'defender', type: 'marine', x: 120, y: 20, currentAngle: Math.PI })!
    attacker.attack = 100
    target.defense = 0
    target.damageShareRadius = 200
    target.damageShareRatio = 0.5
    target.damageShareMaxTargets = 2
    const world = new CombatWorld([attacker, target, allyA, allyB])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)
    const actions: Parameters<typeof applyEcsSingleDamage>[4] = []

    applyEcsSingleDamage(world, 0, 1, attacker.attack, actions)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp - 50)
    expect(world.stores.vitality.require(2).hp).toBe(allyA.maxHp - 25)
    expect(world.stores.vitality.require(3).hp).toBe(allyB.maxHp - 25)
    expect(actions.filter(action => action.type === 'damage_share')).toEqual([
      { unitId: 'attacker', type: 'damage_share', targetId: 'ally-a', damage: 25 },
      { unitId: 'attacker', type: 'damage_share', targetId: 'ally-b', damage: 25 },
    ])
  })
})

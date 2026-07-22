import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem } from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  type: string,
  x: number,
  y: number,
  angle: number,
): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type, x, y, currentAngle: angle })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)
  return world
}

function runNative(units: SimUnit[]) {
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const world = createWorld(units)
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })
  expect(nativeResult).toEqual({ acted: true })
  return { world, nativeActions }
}

function barrageAttacker(id = 'barrage'): SimUnit {
  const attacker = unit(id, 'attacker', 'grenadier', 10, 100, 0)
  attacker.attackType = 'single'
  attacker.aoeRadius = undefined
  return attacker
}

describe('combat ECS barrage attack', () => {
  it('matches impact events and deterministic target order', () => {
    const attacker = barrageAttacker()
    attacker.barrageAttack = {
      impacts: 1,
      radius: 30,
      spreadRadius: 0,
      damageMultiplier: 0.5,
      maxTargetsPerImpact: 3,
    }
    const { world, nativeActions } = runNative([
      attacker,
      unit('primary', 'defender', 'marine', 100, 100, Math.PI),
      unit('b-target', 'defender', 'marine', 100, 110, Math.PI),
      unit('a-target', 'defender', 'marine', 100, 90, Math.PI),
    ])

    for (const entityId of [1, 2, 3]) {
      expect(world.stores.vitality.require(entityId).hp)
        .toBeLessThan(world.stores.vitality.require(entityId).maxHp)
    }
    const barrageDamageOrder = nativeActions
      .slice(nativeActions.findIndex(action => action.type === 'barrage_marker'))
      .filter(action => action.type === 'damage')
      .map(action => action.targetId)
    expect(barrageDamageOrder).toEqual(['primary', 'a-target', 'b-target'])
    expect(nativeActions.filter(action => action.type === 'barrage_marker')).toHaveLength(1)
    expect(nativeActions.filter(action => action.type === 'barrage_impact')).toHaveLength(1)
  })

  it('skips secondary on-hit effects when an impact is intercepted', () => {
    const attacker = barrageAttacker()
    attacker.barrageAttack = {
      impacts: 2,
      radius: 20,
      spreadRadius: 80,
      damageMultiplier: 0.5,
      maxTargetsPerImpact: 2,
    }
    attacker.statusOnHit = [{ type: 'burn', duration: 30, value: 3 }]
    const interceptor = unit('interceptor', 'defender', 'marine', 172, 125, Math.PI)
    interceptor.projectileInterceptRadius = 30
    interceptor.projectileInterceptCooldownMax = 12
    interceptor.projectileInterceptCooldown = 0
    interceptor.projectileInterceptMaxDamage = 100
    const { world, nativeActions } = runNative([
      attacker,
      unit('primary', 'defender', 'marine', 100, 100, Math.PI),
      unit('secondary', 'defender', 'marine', 162, 100, Math.PI),
      interceptor,
    ])

    expect(nativeActions).toContainEqual(expect.objectContaining({
      unitId: 'interceptor',
      type: 'projectile_intercept',
      targetId: 'secondary',
    }))
    expect(world.stores.vitality.require(2).hp).toBe(world.stores.vitality.require(2).maxHp)
    expect(world.stores.statusControl.require(2).statusEffects).toEqual([])
    expect(world.stores.defense.require(3).projectileInterceptCooldown).toBe(12)
  })
})

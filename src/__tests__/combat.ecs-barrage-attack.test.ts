import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem } from '@/domains/combat/ecs/systems'
import { SpatialHash } from '@/domains/combat/spatial-hash'

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

function runParity(units: SimUnit[]) {
  const legacyUnits = structuredClone(units)
  const legacyActions: Parameters<typeof actionSystem>[4] = []
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const legacySpatial = new SpatialHash()
  for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)
  const world = createWorld(units)
  const legacyActed = actionSystem(
    legacyUnits[0],
    legacyUnits[1],
    legacyUnits,
    [],
    legacyActions,
    new PRNG(1),
    0,
    legacySpatial,
  )
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })
  expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
  expect(nativeActions).toEqual(legacyActions)
  return { world, legacyUnits, nativeActions }
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
    const { world, legacyUnits, nativeActions } = runParity([
      attacker,
      unit('primary', 'defender', 'marine', 100, 100, Math.PI),
      unit('b-target', 'defender', 'marine', 100, 110, Math.PI),
      unit('a-target', 'defender', 'marine', 100, 90, Math.PI),
    ])

    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.vitality.require(3).hp).toBe(legacyUnits[3].hp)
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
    const { world, legacyUnits, nativeActions } = runParity([
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
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.vitality.require(2).hp).toBe(world.stores.vitality.require(2).maxHp)
    expect(world.stores.statusControl.require(2).statusEffects).toEqual([])
    expect(world.stores.defense.require(3).projectileInterceptCooldown).toBe(12)
  })
})

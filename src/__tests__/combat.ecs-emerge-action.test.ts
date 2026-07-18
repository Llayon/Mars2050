import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { getDistance, getSizeRadius, PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getEcsPositioningDecision } from '@/domains/combat/ecs/movement-positioning'
import {
  canUseSimpleSingleDamage,
  createEcsMeleeEngagementState,
  isEcsWeaponActionInRange,
  reserveEcsMeleeSlot,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function unit(id: string, team: 'attacker' | 'defender', type: string, x: number): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type,
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  return world
}

function runNative(world: CombatWorld) {
  const actions: Parameters<typeof runActionSystem>[3] = []
  const result = runActionSystem(world, 0, 1, actions, {
    rng: new PRNG(2),
    tick: 0,
    spatialHash: new SpatialHash(),
  })
  return { actions, result }
}

describe('combat ECS emerge strike action', () => {
  it('surfaces a burrowed shock trooper before its native melee hit', () => {
    const shock = unit('shock', 'attacker', 'shock_trooper', 100)
    const target = unit('target', 'defender', 'marine', 150)
    shock.burrowConfig = { damageReduction: 0.45 }
    shock.isBurrowed = true
    const world = createWorld([shock, target])
    reserveEcsMeleeSlot(world, 0, 1, createEcsMeleeEngagementState())
    const transform = world.stores.transform.require(0)
    const targetTransform = world.stores.transform.require(1)
    transform.x = 0
    const point = getEcsPositioningDecision(world, 0, 1, 0, 12, 12).point
    transform.x = point.x
    transform.y = point.y
    transform.currentAngle = Math.atan2(
      targetTransform.y - transform.y,
      targetTransform.x - transform.x,
    )
    const edgeDistance = getDistance(
      transform.x,
      transform.y,
      targetTransform.x,
      targetTransform.y,
    ) - getSizeRadius(transform.size) - getSizeRadius(targetTransform.size)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    expect(isEcsWeaponActionInRange(world, 0, 1, edgeDistance)).toBe(true)
    const { actions, result } = runNative(world)

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(actions.slice(0, 2)).toEqual([
      { unitId: 'shock', type: 'burrow_change', value: 0 },
      { unitId: 'shock', type: 'attack', targetId: 'target' },
    ])
    expect(world.getEntity(0)).toMatchObject({
      isBurrowed: false,
      emergeStrikePending: undefined,
    })
  })

  it('matches legacy one-shot damage and expanded AoE payload', () => {
    const attacker = unit('grenadier', 'attacker', 'grenadier', 100)
    const primary = unit('primary', 'defender', 'marine', 260)
    const splash = unit('splash', 'defender', 'marine', 330)
    attacker.burrowConfig = {
      damageReduction: 0.45,
      emergeAttackMult: 1.3,
      emergeAoeRadiusAdd: 20,
    }
    attacker.isBurrowed = true
    primary.hp = primary.maxHp = 1000
    splash.hp = splash.maxHp = 1000
    const legacyUnits = structuredClone([attacker, primary, splash])
    const world = createWorld([attacker, primary, splash])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(2),
      0,
      legacySpatial,
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const { actions, result } = runNative(world)

    expect(result).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(actions).toEqual(legacyActions)
    expect(actions.slice(0, 3)).toEqual([
      { unitId: 'grenadier', type: 'emerge_strike', value: 1.3 },
      { unitId: 'grenadier', type: 'burrow_change', value: 0 },
      { unitId: 'grenadier', type: 'attack', targetId: 'primary' },
    ])
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
    expect(world.stores.weapon.require(0).emergeStrikePending).toBeUndefined()
  })
})

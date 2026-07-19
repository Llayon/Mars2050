import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'
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

function runStep(world: CombatWorld, legacyUnits: SimUnit[]) {
  const legacyActions: Parameters<typeof actionSystem>[4] = []
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const legacySpatial = new SpatialHash()
  for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)
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
  expect(nativeResult).toEqual({
    acted: legacyActed,
    actorSynchronized: legacyActed,
  })
  expect(nativeActions).toEqual(legacyActions)
  return nativeActions
}

describe('combat ECS artillery action setup', () => {
  it('matches setup-range deployment and the following siege shot', () => {
    const artillery = unit('artillery', 'attacker', 'artillery_crawler', 10, 100, 0)
    const primary = unit('primary', 'defender', 'marine', 460, 100, Math.PI)
    const nearby = unit('nearby', 'defender', 'marine', 480, 100, Math.PI)
    primary.hp = primary.maxHp = 1000
    nearby.hp = nearby.maxHp = 1000
    const units = [artillery, primary, nearby]
    const legacyUnits = structuredClone(units)
    const world = createWorld(units)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const deployActions = runStep(world, legacyUnits)

    expect(deployActions).toEqual([
      { unitId: 'artillery', type: 'stance_change', stanceMode: 'deployed' },
    ])
    expect(world.stores.movement.require(0).stanceMode).toBe('deployed')
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)

    const attackActions = runStep(world, legacyUnits)

    expect(attackActions[0]).toEqual({
      unitId: 'artillery',
      type: 'attack',
      targetId: 'primary',
    })
    expect(attackActions.filter(action => action.type === 'barrage_marker')).toHaveLength(4)
    expect(attackActions.filter(action => action.type === 'barrage_impact')).toHaveLength(4)
    expect(world.stores.combat.require(0).actionCooldown).toBe(144)
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.vitality.require(2).hp).toBe(legacyUnits[2].hp)
  })

  it('keeps artillery from acting inside its minimum range', () => {
    const units = [
      unit('artillery', 'attacker', 'artillery_crawler', 10, 100, 0),
      unit('close-target', 'defender', 'marine', 100, 100, Math.PI),
    ]
    const legacyUnits = structuredClone(units)
    const world = createWorld(units)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const actions = runStep(world, legacyUnits)

    expect(actions).toEqual([])
    expect(world.stores.movement.require(0).stanceMode).toBe('mobile')
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
  })
})

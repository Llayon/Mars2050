import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseEcsSmokeAction,
  canUseSimpleSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function unit(id: string, team: 'attacker' | 'defender', x: number): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
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

describe('combat ECS smoke action', () => {
  it('matches seeded legacy deployment without marking the unit as attacked', () => {
    const attacker = unit('smoker', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.smokeOnAction = {
      radius: 80,
      duration: 30,
      rangeSuppression: 0.5,
      outputSuppression: 0.25,
      accuracySuppression: 0.4,
    }
    attacker.stealthWhileMoving = true
    attacker.movementStealthActive = true
    const legacyUnits = structuredClone([attacker, target])
    const legacyHazards: Parameters<typeof actionSystem>[3] = []
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)
    const world = createWorld([attacker, target])

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      legacyHazards,
      legacyActions,
      new PRNG(7),
      0,
      legacySpatial,
    )
    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(7),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(world.hazards).toEqual(legacyHazards)
    expect(world.hazards).toHaveLength(1)
    expect(world.hazards[0].statusEffects).toEqual([
      { type: 'range_suppressed', duration: 12, value: 0.5 },
      { type: 'output_suppressed', duration: 12, value: 0.25 },
      { type: 'accuracy_reduced', duration: 12, value: 0.4 },
    ])
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
    expect(world.stores.combat.require(0).actionCooldown).toBe(legacyUnits[0].actionCooldown)
    expect(world.stores.statusControl.require(0).hasAttacked).toBe(legacyUnits[0].hasAttacked)
    expect(world.stores.movement.require(0).movementStealthActive).toBe(true)
    expect(nativeActions.some(action =>
      action.type === 'attack' || action.type === 'stealth_change',
    )).toBe(false)

    world.flushStructuralCommands()
    const hazardId = world.getEntityId(world.hazards[0].id)
    expect(hazardId).not.toBeUndefined()
    expect(world.getHazard(hazardId!)).toEqual(world.hazards[0])
  })

  it('reports smoke capability independently from mine routing priority', () => {
    const attacker = unit('hybrid', 'attacker', 100)
    attacker.type = 'minelayer_rover'
    attacker.smokeOnAction = { radius: 80, duration: 30, rangeSuppression: 0.5 }
    const world = createWorld([attacker, unit('target', 'defender', 220)])

    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
  })
})

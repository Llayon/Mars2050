import { describe, expect, it } from 'vitest'
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
  it('deploys deterministically without marking the unit as attacked', () => {
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
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(7),
      tick: 0,
    })

    expect(nativeResult).toEqual({ acted: true })
    world.flushStructuralCommands()
    expect(world.snapshotHazards()).toHaveLength(1)
    expect(world.snapshotHazards()[0].statusEffects).toEqual([
      { type: 'range_suppressed', duration: 12, value: 0.5 },
      { type: 'output_suppressed', duration: 12, value: 0.25 },
      { type: 'accuracy_reduced', duration: 12, value: 0.4 },
    ])
    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
    expect(world.stores.combat.require(0).actionCooldown).toBeGreaterThan(0)
    expect(world.stores.statusControl.require(0).hasAttacked).not.toBe(true)
    expect(world.stores.movement.require(0).movementStealthActive).toBe(true)
    expect(nativeActions.some(action =>
      action.type === 'attack' || action.type === 'stealth_change',
    )).toBe(false)

    world.flushStructuralCommands()
    const hazardId = world.getEntityId(world.snapshotHazards()[0].id)
    expect(hazardId).not.toBeUndefined()
    expect(world.getHazard(hazardId!)).toEqual(world.snapshotHazards()[0])
  })

  it('reports smoke capability independently from mine routing priority', () => {
    const attacker = unit('hybrid', 'attacker', 100)
    attacker.type = 'minelayer_rover'
    attacker.smokeOnAction = { radius: 80, duration: 30, rangeSuppression: 0.5 }
    const world = createWorld([attacker, unit('target', 'defender', 220)])

    expect(canUseEcsSmokeAction(world, 0)).toBe(true)
  })
})

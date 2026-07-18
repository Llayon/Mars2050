import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'
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

describe('combat ECS movement stealth action', () => {
  it('matches legacy stealth break after the primary damage', () => {
    const attacker = unit('ghost', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.stealthWhileMoving = true
    attacker.movementStealthActive = true
    const legacyUnits = structuredClone([attacker, target])
    const world = createWorld([attacker, target])
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
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(1),
      tick: 0,
      spatialHash: new SpatialHash(),
    })

    expect(nativeResult).toEqual({
      acted: legacyActed,
      actorSynchronized: true,
    })
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions.at(-1)).toEqual({
      unitId: 'ghost',
      type: 'stealth_change',
      modeState: 'movement_inactive',
    })
    expect(world.getEntity(0)).toMatchObject({
      hasAttacked: true,
      movementStealthActive: false,
    })
  })

  it('does not emit a redundant event when movement stealth is inactive', () => {
    const attacker = unit('visible', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.stealthWhileMoving = true
    attacker.movementStealthActive = false
    const world = createWorld([attacker, target])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(1),
      tick: 0,
      spatialHash: new SpatialHash(),
    })

    expect(result.acted).toBe(true)
    expect(actions.some(action => action.type === 'stealth_change')).toBe(false)
    expect(world.stores.statusControl.require(0).hasAttacked).toBe(true)
  })
})

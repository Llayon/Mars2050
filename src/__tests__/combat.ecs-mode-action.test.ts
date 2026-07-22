import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseSimpleSingleDamage,
  createEcsMeleeEngagementState,
  reserveEcsMeleeSlot,
  runActionSystem,
} from '@/domains/combat/ecs/systems'

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
  const entitySpatial = new EntitySpatialIndex()
  entitySpatial.rebuild(world)
  world.resources.set('entitySpatial', entitySpatial)
  return world
}

function act(world: CombatWorld) {
  reserveEcsMeleeSlot(world, 0, 1, createEcsMeleeEngagementState())
  const actions: Parameters<typeof runActionSystem>[3] = []
  const result = runActionSystem(world, 0, 1, actions, {
    rng: new PRNG(1),
    tick: 0,
  })
  return { actions, result }
}

describe('combat ECS action mode setup', () => {
  it('lands a jetpack trooper before its native melee attack', () => {
    const trooper = unit('jetpack', 'attacker', 'jetpack_trooper', 100)
    const target = unit('target', 'defender', 'marine', 150)
    trooper.mobilityMode = 'air'
    trooper.isFlying = true
    const world = createWorld([trooper, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const { actions, result } = act(world)

    expect(result).toEqual({ acted: true })
    expect(actions.slice(0, 2)).toEqual([
      { unitId: 'jetpack', type: 'mode_change', modeState: 'ground' },
      { unitId: 'jetpack', type: 'attack', targetId: 'target' },
    ])
    expect(world.stores.movement.require(0).mobilityMode).toBe('ground')
    expect(world.stores.transform.require(0).isFlying).toBe(false)
    expect(world.snapshotEntity(0)).toMatchObject({ mobilityMode: 'ground', isFlying: false })
  })

  it('keeps air mode when groundForAction is disabled', () => {
    const trooper = unit('jetpack', 'attacker', 'jetpack_trooper', 100)
    const target = unit('target', 'defender', 'marine', 150)
    trooper.modeSwitchConfig = { trigger: 'while_moving', groundForAction: false }
    trooper.mobilityMode = 'air'
    trooper.isFlying = true
    const world = createWorld([trooper, target])

    const { actions, result } = act(world)

    expect(result.acted).toBe(true)
    expect(actions.some(action => action.type === 'mode_change')).toBe(false)
    expect(world.snapshotEntity(0)).toMatchObject({ mobilityMode: 'air', isFlying: true })
  })
})

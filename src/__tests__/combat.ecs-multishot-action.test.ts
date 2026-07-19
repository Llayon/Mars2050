import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { canUseSimpleSingleDamage, runActionSystem } from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  type: string,
  x: number,
): SimUnit {
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

function compareAction(units: SimUnit[]) {
  const world = createWorld(units)
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })
  expect(nativeResult).toEqual({ acted: true, actorSynchronized: true })
  expect(world.stores.combat.require(0).actionCooldown).toBeGreaterThan(0)
  return { actions: nativeActions, world }
}

describe('combat ECS multishot action', () => {
  it('matches both doubleshot hits when the primary target survives', () => {
    const sniper = unit('sniper', 'attacker', 'sniper', 100)
    const target = unit('target', 'defender', 'marine', 300)
    sniper.multishot = 2
    sniper.attack = 51
    target.hp = target.maxHp = 200

    const { actions, world } = compareAction([sniper, target])

    expect(actions.filter(action => action.type === 'attack')).toHaveLength(2)
    expect(actions.filter(action => action.type === 'damage')).toHaveLength(2)
    expect(world.stores.vitality.require(1)).toMatchObject({
      hp: 102,
      isDead: false,
    })
  })

  it('stops doubleshot after the first lethal hit', () => {
    const sniper = unit('sniper', 'attacker', 'sniper', 100)
    const target = unit('target', 'defender', 'marine', 300)
    sniper.multishot = 2
    sniper.attack = 51

    const { actions, world } = compareAction([sniper, target])

    expect(actions.filter(action => action.type === 'attack')).toHaveLength(1)
    expect(actions.filter(action => action.type === 'die')).toHaveLength(1)
    expect(world.stores.vitality.require(1).isDead).toBe(true)
  })
})

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

function runStep(world: CombatWorld, acted = true) {
  const nativeActions: Parameters<typeof runActionSystem>[3] = []
  const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
    rng: new PRNG(1),
    tick: 0,
  })
  expect(nativeResult).toEqual({ acted })
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
    const world = createWorld(units)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(false)
    const deployActions = runStep(world)

    expect(deployActions).toEqual([
      { unitId: 'artillery', type: 'stance_change', stanceMode: 'deployed' },
    ])
    expect(world.stores.movement.require(0).stanceMode).toBe('deployed')
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)

    const attackActions = runStep(world)

    expect(attackActions[0]).toEqual({
      unitId: 'artillery',
      type: 'attack_windup',
      targetId: 'primary',
      launchTick: 8,
      projectileKind: 'ground_targeted',
      toX: 460,
      toY: 100,
    })
    expect(attackActions.filter(action => action.type === 'barrage_marker')).toHaveLength(0)
    expect(attackActions.filter(action => action.type === 'barrage_impact')).toHaveLength(0)
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
    expect(world.stores.vitality.require(1).hp).toBe(1000)
    expect(world.stores.vitality.require(2).hp).toBe(1000)
  })

  it('keeps artillery from acting inside its minimum range', () => {
    const units = [
      unit('artillery', 'attacker', 'artillery_crawler', 10, 100, 0),
      unit('close-target', 'defender', 'marine', 100, 100, Math.PI),
    ]
    const world = createWorld(units)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(false)
    const actions = runStep(world, false)

    expect(actions).toEqual([])
    expect(world.stores.movement.require(0).stanceMode).toBe('mobile')
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
  })
})

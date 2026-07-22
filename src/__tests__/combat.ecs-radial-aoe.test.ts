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

function actionContext() {
  return { rng: new PRNG(1), tick: 0 }
}

describe('combat ECS radial AoE', () => {
  it('applies radial damage and deterministic action order', () => {
    const units = [
      unit('grenadier', 'attacker', 'grenadier', 10, 20, 0),
      unit('primary', 'defender', 'marine', 100, 20, Math.PI),
      unit('splash', 'defender', 'marine', 125, 30, Math.PI),
      unit('outside', 'defender', 'marine', 180, 20, Math.PI),
    ]
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld(units)

    const nativeResult = runActionSystem(world, 0, 1, nativeActions, actionContext())

    expect(nativeResult).toEqual({ acted: true })
    expect(world.stores.vitality.require(1).hp)
      .toBeLessThan(world.stores.vitality.require(1).maxHp)
    expect(world.stores.vitality.require(2).hp)
      .toBeLessThan(world.stores.vitality.require(2).maxHp)
    expect(world.stores.vitality.require(3).hp)
      .toBe(world.stores.vitality.require(3).maxHp)
    expect(nativeActions).toContainEqual({
      unitId: 'grenadier',
      type: 'attack',
      targetId: 'splash',
    })
  })

  it('does not propagate squad-wide marks from a secondary hit', () => {
    const scout = unit('scout', 'attacker', 'scout_drone', 10, 20, 0)
    const primary = unit('primary', 'defender', 'marine', 100, 20, Math.PI)
    const splash = unit('splash', 'defender', 'marine', 120, 20, Math.PI)
    const squadmate = unit('squadmate', 'defender', 'marine', 260, 20, Math.PI)
    splash.squadId = 'splash-squad'
    squadmate.squadId = 'splash-squad'
    const world = createWorld([scout, primary, splash, squadmate])
    const weapon = world.stores.weapon.require(0)
    weapon.attackType = 'aoe'
    weapon.aoeRadius = 60
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, actionContext())

    expect(result).toEqual({ acted: true })
    expect(world.stores.statusControl.require(2).targetMark).toMatchObject({
      sourceUnitId: 'scout',
      squadWide: true,
    })
    expect(world.stores.statusControl.require(3).targetMark).toBeUndefined()
  })
})

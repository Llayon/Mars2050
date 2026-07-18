import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
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

describe('combat ECS on-kill action', () => {
  it('matches cooldown reset and actual healing after a confirmed kill', () => {
    const attacker = unit('ghost', 'attacker', 'stealth_operative', 100)
    const target = unit('target', 'defender', 'marine', 220)
    attacker.hp = 50
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacySpatial = new SpatialHash()
    for (const legacyUnit of legacyUnits) legacySpatial.insert(legacyUnit)
    const world = createWorld([attacker, target])

    const legacyActed = actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(29),
      0,
      legacySpatial,
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    const nativeResult = runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(29),
      tick: 0,
      spatialHash: new SpatialHash(),
    })

    expect(nativeResult).toEqual({ acted: legacyActed, actorSynchronized: true })
    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions.map(action => action.type)).toEqual([
      'attack',
      'unit_blocked_damage',
      'damage',
      'die',
      'on_kill',
      'heal',
    ])
    expect(world.getEntity(0)).toMatchObject({
      hp: legacyUnits[0].hp,
      actionCooldown: 0,
    })
    expect(world.getEntity(1)).toMatchObject({
      hp: legacyUnits[1].hp,
      isDead: true,
    })
    expect(nativeActions.at(-1)).toEqual({
      unitId: 'ghost',
      type: 'heal',
      targetId: 'ghost',
      damage: 25,
    })
  })
})

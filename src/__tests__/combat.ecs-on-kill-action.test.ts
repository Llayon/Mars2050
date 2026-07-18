import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseEcsPostHitTriggers,
  canUseSimpleSingleDamage,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
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

  it('matches kill-trigger healing before replication and death hazards', () => {
    const attacker = unit('recycler', 'attacker', 'marine', 100)
    const target = unit('victim', 'defender', 'marine', 220)
    attacker.attack = 200
    attacker.hp = 40
    attacker.maxHp = 100
    attacker.replicateOnKill = true
    attacker.triggerEffects = [{
      id: 'wreckage-recycling',
      event: 'kill',
      payload: {
        kind: 'heal',
        target: 'self',
        victimMaxHpPercent: 0.5,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    target.hp = 20
    target.maxHp = 80
    target.defense = 0
    target.onDeathPuddle = 'acid'
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const legacyHazards: Parameters<typeof actionSystem>[3] = []
    const world = createWorld([attacker, target])
    world.resources.set('rng', new PRNG(73))

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      legacyHazards,
      legacyActions,
      new PRNG(73),
    )
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, {
      rng: world.resources.require('rng'),
      tick: 0,
      spatialHash: new SpatialHash(),
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(0).hp).toBe(80)
    expect(world.stores.lifecycle.require(0).triggerEffects).toEqual(
      legacyUnits[0].triggerEffects,
    )
    expect(nativeActions.slice(-4).map(action => action.type)).toEqual([
      'trigger_effect',
      'heal',
      'spawn',
      'hazard_spawn',
    ])
  })

  it('keeps unsupported kill damage on the legacy weapon path', () => {
    const attacker = unit('carrier', 'attacker', 'marine', 100)
    const target = unit('victim', 'defender', 'marine', 220)
    attacker.triggerEffects = [{
      id: 'kill-blast',
      event: 'kill',
      payload: {
        kind: 'damage',
        target: 'victim',
        amount: 20,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const world = createWorld([attacker, target])

    expect(canUseEcsPostHitTriggers(world, 0, 1)).toBe(false)
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(false)
  })
})

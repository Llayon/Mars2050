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

function context(seed: number) {
  return { rng: new PRNG(seed), tick: 0, spatialHash: new SpatialHash() }
}

describe('combat ECS post-hit triggers', () => {
  it('matches repeatable attack counters and cooldown reset', () => {
    const attacker = unit('gunner', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.attack = 10
    attacker.triggerEffects = [{
      id: 'compression-reset',
      event: 'attack_count',
      count: 2,
      repeatable: true,
      payload: { kind: 'cooldown_reset', target: 'self' },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    target.hp = target.maxHp = 100
    target.defense = 0
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    actionSystem(legacyUnits[0], legacyUnits[1], legacyUnits, [], legacyActions, new PRNG(43))
    runActionSystem(world, 0, 1, nativeActions, context(43))
    legacyUnits[0].actionCooldown = 0
    world.stores.combat.require(0).actionCooldown = 0
    actionSystem(legacyUnits[0], legacyUnits[1], legacyUnits, [], legacyActions, new PRNG(47))
    runActionSystem(world, 0, 1, nativeActions, context(47))

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
    expect(world.stores.lifecycle.require(0).triggerEffects).toEqual(
      legacyUnits[0].triggerEffects,
    )
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual([
      'damage',
      'trigger_effect',
    ])
  })

  it('matches damage-threshold status payloads before death resolution', () => {
    const attacker = unit('attacker', 'attacker', 100)
    const target = unit('counter', 'defender', 220)
    attacker.attack = 10
    target.hp = target.maxHp = 100
    target.defense = 0
    target.triggerEffects = [{
      id: 'counter-range',
      event: 'damage_taken',
      threshold: 5,
      repeatable: true,
      cooldownTicks: 2,
      payload: {
        kind: 'status',
        target: 'self',
        status: { type: 'range_boost', duration: 10, value: 0.5 },
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    actionSystem(legacyUnits[0], legacyUnits[1], legacyUnits, [], legacyActions, new PRNG(53))
    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, context(53))

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.lifecycle.require(1).triggerEffects).toEqual(
      legacyUnits[1].triggerEffects,
    )
    expect(world.getEntity(1)?.statusEffects).toEqual(legacyUnits[1].statusEffects)
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual([
      'trigger_effect',
      'status_apply',
    ])
  })

  it('keeps unsupported trigger payloads on the legacy path', () => {
    const attacker = unit('field-owner', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.triggerEffects = [{
      id: 'field-trigger',
      event: 'attack_count',
      count: 1,
      payload: {
        kind: 'field',
        target: 'self',
        field: {
          id: 'dome',
          kind: 'barrier_dome',
          radius: 80,
          intervalTicks: 99,
          capacity: 30,
        },
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

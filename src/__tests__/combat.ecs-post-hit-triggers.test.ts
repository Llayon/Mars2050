import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import {
  canUseSimpleSingleDamage,
  recordEcsAttackTriggers,
  runActionSystem,
} from '@/domains/combat/ecs/systems'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'

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
  return { rng: new PRNG(seed), tick: 0 }
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
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, context(43))
    world.stores.combat.require(0).actionCooldown = 0
    runActionSystem(world, 0, 1, nativeActions, context(47))

    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
    expect(world.stores.lifecycle.require(0).triggerEffects?.[0]).toMatchObject({
      fired: true,
      counter: 0,
    })
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
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = createWorld([attacker, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    runActionSystem(world, 0, 1, nativeActions, context(53))

    expect(world.stores.lifecycle.require(1).triggerEffects?.[0]).toMatchObject({
      fired: true,
      cooldownRemaining: 2,
    })
    expect(world.stores.statusControl.require(1).statusEffects)
      .toContainEqual(expect.objectContaining({
        type: 'range_boost',
        value: 0.5,
      }))
    expect(nativeActions.slice(-2).map(action => action.type)).toEqual([
      'trigger_effect',
      'status_apply',
    ])
  })

  it('matches direct trigger damage on the native path', () => {
    const attacker = unit('blast-owner', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    target.hp = target.maxHp = 100
    target.defense = 0
    attacker.triggerEffects = [{
      id: 'blast-trigger',
      event: 'attack_count',
      count: 1,
      payload: {
        kind: 'damage',
        target: 'target',
        amount: 20,
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const nativeActions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([attacker, target])

    recordEcsAttackTriggers(world, 0, 1, nativeActions)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    expect(world.stores.vitality.require(1).hp).toBe(80)
    expect(nativeActions.map(action => action.type)).toEqual([
      'trigger_effect',
      'damage',
    ])
  })

  it('matches finite trigger barriers and their damage break order', () => {
    const owner = unit('accumulator', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    const enemy = unit('enemy', 'defender', 180)
    owner.triggerEffects = [{
      id: 'accumulator-shield',
      event: 'attack_count',
      count: 2,
      payload: {
        kind: 'field',
        target: 'self',
        field: {
          id: 'accumulator-dome',
          kind: 'barrier_dome',
          radius: 80,
          intervalTicks: 99,
          duration: 20,
          capacity: 30,
        },
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    enemy.attack = 50
    const nativeActions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([owner, target, enemy])
    world.resources.set('clock', {
      tick: 7,
      dt: 0.1,
      maxTicks: 400,
      timeoutPolicy: 'draw',
    })

    recordEcsAttackTriggers(world, 0, 1, nativeActions)
    recordEcsAttackTriggers(world, 0, 1, nativeActions)
    world.flushStructuralCommands()

    expect(world.snapshotHazards()).toEqual([
      expect.objectContaining({
        type: 'barrier_dome',
        capacity: 30,
        sourceUnitId: 'accumulator',
      }),
    ])
    applyEcsSingleDamage(world, 2, 0, 50, nativeActions, {
      allowPercentHpDamage: false,
      interceptable: false,
    })

    expect(world.stores.hazard.require(3).capacity).toBe(0)
    expect(nativeActions).toContainEqual(expect.objectContaining({
      unitId: 'accumulator',
      type: 'barrier_break',
    }))
  })
})

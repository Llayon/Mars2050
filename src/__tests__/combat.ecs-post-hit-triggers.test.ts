import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { actionSystem } from '@/domains/combat/combat.systems'
import { recordAttackTrigger } from '@/domains/combat/combat.triggers'
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
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof recordAttackTrigger>[2]['actions'] = []
    const nativeActions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([attacker, target])

    recordAttackTrigger(legacyUnits[0], legacyUnits[1], {
      units: legacyUnits,
      hazards: [],
      actions: legacyActions,
      rng: new PRNG(59),
    })
    recordEcsAttackTriggers(world, 0, 1, nativeActions)

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(1).hp).toBe(legacyUnits[1].hp)
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
    const legacyUnits = structuredClone([owner, target, enemy])
    const legacyActions: Parameters<typeof recordAttackTrigger>[2]['actions'] = []
    const legacyHazards: Parameters<typeof recordAttackTrigger>[2]['hazards'] = []
    const nativeActions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([owner, target, enemy])
    world.resources.set('clock', {
      tick: 7,
      dt: 0.1,
      maxTicks: 400,
      timeoutPolicy: 'draw',
    })

    const legacyContext = {
      units: legacyUnits,
      hazards: legacyHazards,
      actions: legacyActions,
      rng: new PRNG(97),
      tick: 7,
    }
    recordAttackTrigger(legacyUnits[0], legacyUnits[1], legacyContext)
    recordEcsAttackTriggers(world, 0, 1, nativeActions)
    recordAttackTrigger(legacyUnits[0], legacyUnits[1], legacyContext)
    recordEcsAttackTriggers(world, 0, 1, nativeActions)
    world.flushStructuralCommands()

    expect(nativeActions).toEqual(legacyActions)
    expect(world.hazards).toEqual(legacyHazards)
    applyCombatDamage(
      legacyUnits[2],
      legacyUnits[0],
      50,
      legacyActions,
      { units: legacyUnits, hazards: legacyHazards },
    )
    applyEcsSingleDamage(world, 2, 0, 50, nativeActions, {
      allowPercentHpDamage: false,
      interceptable: false,
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.hazard.require(3).capacity).toBe(0)
  })
})

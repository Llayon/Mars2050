import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processHpThresholdTriggers } from '@/domains/combat/combat.triggers'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import {
  canUseSimpleSingleDamage,
  processEcsHpThresholdTriggers,
} from '@/domains/combat/ecs/systems'

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

describe('combat ECS hp-threshold triggers', () => {
  it('matches one-shot shield triggers', () => {
    const owner = unit('tank', 'attacker', 100)
    owner.hp = 40
    owner.maxHp = 100
    owner.triggerEffects = [{
      id: 'emergency-armor',
      event: 'hp_threshold',
      threshold: 0.5,
      payload: { kind: 'shield', target: 'self', amount: 30 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacy = structuredClone(owner)
    const legacyActions: Parameters<typeof processHpThresholdTriggers>[1]['actions'] = []
    const nativeActions: Parameters<typeof processEcsHpThresholdTriggers>[2] = []
    const world = new CombatWorld([owner])

    processHpThresholdTriggers(legacy, {
      units: [legacy],
      hazards: [],
      actions: legacyActions,
      rng: new PRNG(61),
    })
    processEcsHpThresholdTriggers(world, 0, nativeActions)
    processHpThresholdTriggers(legacy, {
      units: [legacy],
      hazards: [],
      actions: legacyActions,
      rng: new PRNG(67),
    })
    processEcsHpThresholdTriggers(world, 0, nativeActions)

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(0).shield).toBe(30)
    expect(world.stores.lifecycle.require(0).triggerEffects).toEqual(
      legacy.triggerEffects,
    )
  })

  it('enables native attacks for separately scheduled damage triggers', () => {
    const attacker = unit('threshold-owner', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.triggerEffects = [{
      id: 'disintegration',
      event: 'hp_threshold',
      threshold: 0.5,
      payload: { kind: 'damage', target: 'nearest_enemy', amount: 5 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const world = new CombatWorld([attacker, target])

    expect(canUseSimpleSingleDamage(world, 0, 1)).toBe(true)
  })

  it('matches native percent-HP damage and synchronizes stores', () => {
    const owner = unit('disintegrator', 'attacker', 100)
    const target = unit('target', 'defender', 180)
    owner.hp = 40
    owner.maxHp = 100
    owner.triggerEffects = [{
      id: 'disintegration',
      event: 'hp_threshold',
      threshold: 0.5,
      payload: {
        kind: 'damage',
        target: 'nearest_enemy',
        amount: 5,
        percentHp: { basis: 'current', percent: 0.25 },
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    target.hp = 80
    target.maxHp = 200
    target.defense = 0
    const legacyUnits = structuredClone([owner, target])
    const legacyActions: Parameters<typeof processHpThresholdTriggers>[1]['actions'] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(owner, target)
    runtime.world.flushStructuralCommands()
    const actions: BattleAction[] = []
    processHpThresholdTriggers(legacyUnits[0], {
      units: legacyUnits,
      hazards: [],
      actions: legacyActions,
      rng: new PRNG(71),
    })
    runtime.runPostHazardPhase(12, actions, new PRNG(71))

    const targetId = runtime.world.getEntityId('target')!
    const ownerId = runtime.world.getEntityId('disintegrator')!
    expect(runtime.world.stores.vitality.require(targetId).hp).toBe(legacyUnits[1].hp)
    expect(actions).toEqual(legacyActions)
    expect(runtime.world.stores.lifecycle.require(ownerId).triggerEffects?.[0].fired)
      .toBe(true)
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'disintegrator',
      type: 'trigger_effect',
      targetId: 'target',
    }))
  })

  it('reads threshold state from the canonical vitality store', () => {
    const owner = unit('store-owner', 'attacker', 100)
    owner.hp = owner.maxHp = 100
    owner.triggerEffects = [{
      id: 'store-shield',
      event: 'hp_threshold',
      threshold: 0.5,
      payload: { kind: 'shield', target: 'self', amount: 25 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(owner)
    runtime.world.flushStructuralCommands()
    const ownerId = runtime.world.getEntityId(owner.id)!
    runtime.world.stores.vitality.require(ownerId).hp = 40
    const actions: BattleAction[] = []

    expect(owner.hp).toBe(100)
    runtime.runPostHazardPhase(14, actions, new PRNG(73))

    expect(runtime.world.stores.vitality.require(ownerId)).toMatchObject({
      hp: 40,
      shield: 25,
    })
    expect(actions.map(action => action.type)).toEqual([
      'trigger_effect',
      'shield_apply',
    ])
  })
})

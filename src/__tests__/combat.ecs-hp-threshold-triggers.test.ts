import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
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
    const nativeActions: Parameters<typeof processEcsHpThresholdTriggers>[2] = []
    const world = new CombatWorld([owner])

    processEcsHpThresholdTriggers(world, 0, nativeActions)
    processEcsHpThresholdTriggers(world, 0, nativeActions)

    expect(nativeActions.filter(action => action.type === 'trigger_effect')).toHaveLength(1)
    expect(nativeActions).toContainEqual({
      unitId: 'tank',
      type: 'shield_apply',
      targetId: 'tank',
      damage: 30,
    })
    expect(world.stores.vitality.require(0).shield).toBe(30)
    expect(world.stores.lifecycle.require(0).triggerEffects?.[0].fired).toBe(true)
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
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(owner, target)
    runtime.world.flushStructuralCommands()
    const actions: BattleAction[] = []
    runtime.runPhase('hp_threshold_trigger', { tick: 12, actions, rng: new PRNG(71) })

    const targetId = runtime.world.getEntityId('target')!
    const ownerId = runtime.world.getEntityId('disintegrator')!
    expect(runtime.world.stores.vitality.require(targetId).hp).toBe(55)
    expect(runtime.world.stores.lifecycle.require(ownerId).triggerEffects?.[0].fired)
      .toBe(true)
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'disintegrator',
      type: 'trigger_effect',
      targetId: 'target',
    }))
    expect(actions).toContainEqual({
      unitId: 'disintegrator',
      type: 'percent_hp_damage',
      targetId: 'target',
      value: 20,
    })
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
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(owner)
    runtime.world.flushStructuralCommands()
    const ownerId = runtime.world.getEntityId(owner.id)!
    runtime.world.stores.vitality.require(ownerId).hp = 40
    const actions: BattleAction[] = []

    expect(owner.hp).toBe(100)
    runtime.runPhase('hp_threshold_trigger', { tick: 14, actions, rng: new PRNG(73) })

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

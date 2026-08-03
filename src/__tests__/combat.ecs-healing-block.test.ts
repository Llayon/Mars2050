import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import {
  applyEcsHealing,
  applyEcsHealingFromSource,
} from '@/domains/combat/ecs/systems/healing-system'

describe('combat ECS healing block', () => {
  it('blocks regular healing while burn is active', () => {
    const medic = createRuntimeUnitFromConfig({
      id: 'medic',
      team: 'attacker',
      type: 'medic',
      x: 10,
      y: 10,
      currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'attacker',
      type: 'marine',
      x: 20,
      y: 10,
      currentAngle: 0,
    })!
    target.hp = 10
    target.statusEffects.push(normalizeStatusEffect({
      type: 'burn',
      duration: 10,
      value: 3,
    }))
    const world = new CombatWorld([medic, target])
    const actions: BattleAction[] = []

    expect(applyEcsHealing(world, 0, 1, 30, actions)).toBe(0)
    expect(world.stores.vitality.require(1).hp).toBe(10)
    expect(actions).toEqual([{
      unitId: 'medic',
      type: 'heal_blocked',
      targetId: 'target',
      statusType: 'burn',
      value: 30,
    }])
  })

  it('allows explicit revival healing to bypass burn', () => {
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'attacker',
      type: 'marine',
      x: 20,
      y: 10,
      currentAngle: 0,
    })!
    target.hp = 0
    target.statusEffects.push(normalizeStatusEffect({
      type: 'burn',
      duration: 10,
      value: 3,
    }))
    const world = new CombatWorld([target])
    const actions: BattleAction[] = []

    expect(applyEcsHealingFromSource(
      world,
      'revival',
      0,
      25,
      actions,
      { bypassStatusBlock: true },
    )).toBe(25)
    expect(world.stores.vitality.require(0).hp).toBe(25)
    expect(actions[0]).toMatchObject({ type: 'heal', damage: 25 })
  })
})

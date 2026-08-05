import { describe, expect, it } from 'vitest'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { applyEcsCapturedDamage } from '@/domains/combat/ecs/systems/damage-system'
import { resolveEcsDeath } from '@/domains/combat/ecs/systems/death-system'
import type { DamageSourceContext } from '@/domains/combat/ecs/damage-source'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { createCombatMetrics, recordCombatActions } from '@/domains/combat/combat.metrics'

function source(sourceEntityId?: number): DamageSourceContext {
  return {
    attribution: {
      sourceExternalId: 'retired-missile',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
      sourceEntityId,
    },
    attack: 40,
    modifiers: {
      attackBoostValue: 0,
      outputSuppression: 0,
      accuracyPenalty: 0,
      accuracyPenaltyResist: 0,
      armorPierceRatio: 0,
      summonCounterDamageMult: 1,
      shieldDamageMult: 1,
      lifestealMult: 0,
      executeThreshold: 0,
    },
  }
}

describe('captured ECS damage source', () => {
  it('resolves damage when the source entity is not present', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    target.defense = 0
    const world = new CombatWorld([target])
    const actions: Parameters<typeof applyEcsCapturedDamage>[4] = []

    const result = applyEcsCapturedDamage(world, source(), 0, 40, actions)

    expect(result.damage).toBe(40)
    expect(world.stores.vitality.require(0).hp).toBe(target.maxHp - 40)
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'retired-missile',
      type: 'damage',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
      targetId: 'target',
      damage: 40,
    }))
  })

  it('keeps captured metadata when the referenced source entity was removed', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    target.defense = 0
    const world = new CombatWorld([target])
    const actions: Parameters<typeof applyEcsCapturedDamage>[4] = []

    applyEcsCapturedDamage(world, source(99), 0, 40, actions)

    expect(actions).toContainEqual(expect.objectContaining({
      type: 'damage',
      unitId: 'retired-missile',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
      damage: 40,
    }))
  })

  it('keeps death attribution when the referenced source entity was removed', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([target])
    world.stores.vitality.require(0).hp = 0
    const actions: Parameters<typeof resolveEcsDeath>[3] = []

    expect(resolveEcsDeath(world, 0, source(99).attribution, actions)).toBe(true)
    expect(actions).toContainEqual(expect.objectContaining({
      type: 'die',
      sourceUnitId: 'retired-missile',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
    }))
  })

  it('projects queued damage through the action-group ledger', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([target])
    const ledger = new EcsActionGroupLedger()
    world.resources.set('actionGroup', ledger)
    ledger.begin(world, world.query(['identity', 'vitality']))

    ledger.queueDamage(0, source().attribution, 25)

    expect(ledger.getProjectedHp(world, 0)).toBe(target.maxHp - 25)
  })

  it('attributes source-free damage to metrics by captured unit type', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([target])
    const metrics = createCombatMetrics(world)

    recordCombatActions(metrics, 0, [{
      unitId: 'retired-missile',
      type: 'damage',
      targetId: 'target',
      sourceUnitId: 'retired-missile',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
      damage: 7,
    }], world)

    expect(metrics.damageByUnitType.missile_buggy).toBe(7)
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { applyEcsCapturedDamage, applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'

function unit(id: string, team: 'attacker' | 'defender'): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x: 100, y: team === 'attacker' ? 100 : 106, currentAngle: 0 })!
}

function world(attacker: SimUnit, target: SimUnit): CombatWorld {
  const result = new CombatWorld([attacker, target])
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(result)
  result.resources.set('entitySpatial', spatial)
  result.resources.set('defenseResolutionMode', 'v8_sequential')
  return result
}

function damage(world: CombatWorld, amount: number, options: Parameters<typeof applyEcsSingleDamage>[5] = {}) {
  const actions: BattleAction[] = []
  const result = applyEcsSingleDamage(world, world.getEntityId('attacker')!, world.getEntityId('target')!, amount, actions, { interceptable: false, ...options })
  return { result, actions, target: world.stores.vitality.require(world.getEntityId('target')!) }
}

describe('Combat ECS V8 damage characterization', () => {
  it('records primary HP damage and action breakdown', () => {
    const result = damage(world(unit('attacker', 'attacker'), unit('target', 'defender')), 20)
    expect(result.result.damage).toBe(18)
    expect(result.result.blockedDamage).toBe(2)
    expect(result.actions).toContainEqual(expect.objectContaining({ type: 'damage', damage: 18 }))
    expect(result.actions).toContainEqual(expect.objectContaining({ type: 'unit_blocked_damage', damage: 2 }))
  })

  it('records shield absorption and overflow', () => {
    const target = unit('target', 'defender')
    target.shield = target.maxShield = 8
    const result = damage(world(unit('attacker', 'attacker'), target), 20)
    expect(result.result.shieldDamage).toBe(8)
    expect(result.result.damage).toBe(10)
    expect(result.target.shield).toBe(0)
  })

  it('records minimum damage and explicit zero-damage bypass', () => {
    const first = damage(world(unit('attacker', 'attacker'), unit('target', 'defender')), 1)
    expect(first.result.damage).toBe(1)
    const second = damage(world(unit('attacker', 'attacker'), unit('target', 'defender')), 1, { allowMinimumDamage: false })
    expect(second.result.damage).toBe(0)
  })

  it('records execute damage against current HP', () => {
    const attacker = unit('attacker', 'attacker')
    attacker.executeThreshold = 50
    const target = unit('target', 'defender')
    target.hp = 40
    const result = damage(world(attacker, target), 5)
    expect(result.result.damage).toBe(40)
    expect(result.target.hp).toBe(0)
  })

  it('records shared damage and recipient HP', () => {
    const attacker = unit('attacker', 'attacker')
    const target = unit('target', 'defender')
    const ally = unit('ally', 'defender')
    ally.x = 120
    target.damageShareRadius = 100
    target.damageShareRatio = 0.5
    target.damageShareMaxTargets = 1
    const resultWorld = world(attacker, target)
    resultWorld.queueUnitCreation(ally)
    resultWorld.flushStructuralCommands()
    const actions: BattleAction[] = []
    const result = applyEcsSingleDamage(resultWorld, resultWorld.getEntityId('attacker')!, resultWorld.getEntityId('target')!, 20, actions, { interceptable: false })
    expect(result.sharedDamage).toBeGreaterThan(0)
    expect(resultWorld.stores.vitality.require(resultWorld.getEntityId('ally')!).hp).toBeLessThan(ally.maxHp)
  })

  it('preserves deleted-source attribution metadata', () => {
    const resultWorld = world(unit('attacker', 'attacker'), unit('target', 'defender'))
    const actions: BattleAction[] = []
    const result = applyEcsCapturedDamage(resultWorld, {
      attribution: { sourceExternalId: 'deleted-source', sourceUnitType: 'burner', sourceTeam: 'attacker' },
      attack: 20,
      modifiers: { attackBoostValue: 0, outputSuppression: 0, accuracyPenalty: 0, accuracyPenaltyResist: 0, armorPierceRatio: 0, summonCounterDamageMult: 1, shieldDamageMult: 1, lifestealMult: 0, executeThreshold: 0 },
    }, resultWorld.getEntityId('target')!, 20, actions, { interceptable: false })
    expect(result.damage).toBe(18)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'damage', sourceUnitType: 'burner', sourceTeam: 'attacker' }))
  })
})

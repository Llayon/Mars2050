import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'
import { recordEcsDamageTakenTriggers, recordEcsResolvedDamageTakenTriggers } from '@/domains/combat/ecs/systems/post-hit-trigger-system'

type DamageTakenTarget = 'self' | 'target' | 'victim' | 'attacker'

function unit(id: string, team: SimUnit['team'], x: number): SimUnit {
  const result = createRuntimeUnitFromConfig({ id, team, type: 'marine', x, y: 100, currentAngle: 0 })!
  result.hp = result.maxHp = 100
  result.defense = 0
  return result
}

function createWorld(mode: 'v8_sequential' | 'v9_snapshot', target: DamageTakenTarget, amount: number): CombatWorld {
  const attacker = unit('incoming-attacker', 'attacker', 100)
  const owner = unit('damage-taken-owner', 'defender', 120)
  owner.triggerEffects = [{
    id: `counter-${target}`,
    event: 'damage_taken',
    threshold: 1,
    payload: { kind: 'damage', target, amount },
    fired: false,
    counter: 0,
    cooldownRemaining: 0,
  }]
  const world = new CombatWorld([attacker, owner])
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  world.resources.set('defenseResolutionMode', mode)
  return world
}

function runScenario(mode: 'v8_sequential' | 'v9_snapshot', target: DamageTakenTarget, amount = 10): { attackerHp: number; ownerHp: number; damage: { unitId: string; targetId?: string; damage?: number }[]; actions: BattleAction[] } {
  const world = createWorld(mode, target, amount)
  const actions: BattleAction[] = []
  const result = applyEcsSingleDamage(world, 0, 1, 10, actions, { interceptable: false })
  if (mode === 'v8_sequential') recordEcsDamageTakenTriggers(world, 0, 1, result.damage, actions)
  else drainV9FollowUps(world, { tick: 0, actions })
  return {
    attackerHp: world.stores.vitality.require(0).hp,
    ownerHp: world.stores.vitality.require(1).hp,
    damage: actions.filter(action => action.type === 'damage').map(action => ({ unitId: action.unitId, targetId: action.targetId, damage: action.damage })),
    actions,
  }
}

describe('V8/V9 damage-taken trigger semantics', () => {
  it.each(['self', 'target', 'victim', 'attacker'] as const)('preserves target routing for damage_taken → %s', target => {
    const v8 = runScenario('v8_sequential', target)
    const v9 = runScenario('v9_snapshot', target)

    expect(v9.attackerHp).toBe(v8.attackerHp)
    expect(v9.ownerHp).toBe(v8.ownerHp)
    expect(v9.damage).toEqual(v8.damage)
    if (target === 'self') {
      expect(v9.attackerHp).toBe(100)
      expect(v9.ownerHp).toBe(80)
    } else {
      expect(v9.attackerHp).toBe(90)
      expect(v9.ownerHp).toBe(90)
    }
  })

  it('attributes lethal counter-damage to the damage-taken trigger owner', () => {
    const v8 = runScenario('v8_sequential', 'attacker', 100)
    const v9 = runScenario('v9_snapshot', 'attacker', 100)

    expect(v8.actions.find(action => action.type === 'die')?.sourceUnitId).toBe('damage-taken-owner')
    expect(v9.actions.find(action => action.type === 'die')?.sourceUnitId).toBe('damage-taken-owner')
    expect(v9.attackerHp).toBe(v8.attackerHp)
  })

  it('retains the owner source context when the counter-trigger owner dies before drain', () => {
    const world = createWorld('v9_snapshot', 'attacker', 20)
    const actions: BattleAction[] = []
    applyEcsSingleDamage(world, 0, 1, 10, actions, { interceptable: false })
    world.setEntityDead(1, true)

    drainV9FollowUps(world, { tick: 0, actions })

    expect(world.stores.vitality.require(0).hp).toBe(80)
    expect(actions.find(action => action.type === 'damage' && action.targetId === 'incoming-attacker')).toMatchObject({
      unitId: 'damage-taken-owner', damage: 20,
    })
  })

  it('fires a self-targeted damage-taken payload after the incoming source is removed', () => {
    const world = createWorld('v9_snapshot', 'self', 20)
    const actions: BattleAction[] = []

    recordEcsResolvedDamageTakenTriggers(world, 1, {
      sourceExternalId: 'removed-attacker',
      sourceEntityId: 0,
      sourceTeam: 'attacker',
      sourceUnitType: 'marine',
    }, 10, actions)
    drainV9FollowUps(world, { tick: 0, actions })

    expect(world.stores.vitality.require(1).hp).toBe(80)
    expect(actions.find(action => action.type === 'trigger_effect')).toMatchObject({
      unitId: 'damage-taken-owner',
      targetId: 'damage-taken-owner',
      sourceUnitId: 'removed-attacker',
    })
  })

  it('retains causal routing but skips an attacker-targeted payload when the removed attacker is not live', () => {
    const world = createWorld('v9_snapshot', 'attacker', 20)
    const actions: BattleAction[] = []

    recordEcsResolvedDamageTakenTriggers(world, 1, {
      sourceExternalId: 'removed-attacker',
      sourceTeam: 'attacker',
      sourceUnitType: 'marine',
    }, 10, actions)
    drainV9FollowUps(world, { tick: 0, actions })

    expect(world.stores.vitality.require(1).hp).toBe(100)
    expect(actions.find(action => action.type === 'trigger_effect')).toMatchObject({
      unitId: 'damage-taken-owner',
      targetId: 'removed-attacker',
      sourceUnitId: 'removed-attacker',
    })
    expect(actions.filter(action => action.type === 'damage')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runEcsSupportAuraSystem } from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  x: number,
): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS support aura phase', () => {
  it('applies shields, cleanse, reveal, and support statuses', () => {
    const source = unit('source', 'attacker', 100)
    source.supportAuras = [
      { type: 'shield_repair', radius: 120, value: 10, interval: 10, target: 'allies' },
      { type: 'shield', radius: 120, value: 30, interval: 10, target: 'allies' },
      { type: 'regen', radius: 120, value: 4, duration: 8, interval: 10, target: 'allies' },
      { type: 'cleanse', radius: 120, value: 0, interval: 10, target: 'allies' },
      { type: 'status_immunity', radius: 120, value: 0, duration: 8, interval: 10, target: 'allies' },
      { type: 'haste', radius: 120, value: 0.2, duration: 8, interval: 10, target: 'allies' },
      { type: 'range_boost', radius: 120, value: 0.25, duration: 8, interval: 10, target: 'allies' },
      { type: 'attack_boost', radius: 120, value: 0.3, duration: 8, interval: 10, target: 'allies' },
      { type: 'damage_reduction', radius: 120, value: 0.15, duration: 8, interval: 10, target: 'allies' },
      { type: 'reveal', radius: 180, value: 0, duration: 8, interval: 10, target: 'enemies' },
    ]
    const ally = unit('ally', 'attacker', 150)
    ally.maxShield = 20
    ally.shield = 5
    ally.statusEffects.push(normalizeStatusEffect({ type: 'burn', duration: 10 }))
    const enemy = unit('enemy', 'defender', 220)
    enemy.stealthUntilAttack = true
    const ecs = createEcsCombatRuntime()
    for (const candidate of [source, enemy, ally]) {
      ecs.world.queueUnitCreation(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    for (const tick of [0, 1]) {
      ecs.runPhase('support_aura', { tick, actions: ecsActions })
    }

    expect(ecsActions.filter(action => action.type === 'shield_apply'))
      .toHaveLength(2)
    expect(ecs.world.stores.statusControl.require(1).statusEffects)
      .toContainEqual(expect.objectContaining({ type: 'revealed' }))
    expect(ecs.world.stores.statusControl.require(2).statusEffects)
      .not.toContainEqual(expect.objectContaining({ type: 'burn' }))
  })

  it('reads canonical aura configuration and applies tag filters locally', () => {
    const world = new CombatWorld([
      unit('source', 'attacker', 100),
      unit('ally', 'attacker', 150),
    ])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    world.stores.support.require(0).supportAuras = [{
      type: 'haste',
      radius: 100,
      value: 0.2,
      interval: 10,
      target: 'allies',
      targetTags: ['infantry'],
    }]
    world.setUnitCapability(0, 'supportAuraCapability', true)
    world.stores.statusControl.require(1).statusEffects = []
    spatial.rebuild(world)
    const actions: BattleAction[] = []

    runEcsSupportAuraSystem(world, 0, actions)

    expect(world.stores.statusControl.require(1).statusEffects)
      .toContainEqual(expect.objectContaining({ type: 'haste', value: 0.2 }))
    expect(actions[0]).toMatchObject({
      unitId: 'ally',
      type: 'status_apply',
      statusType: 'haste',
    })
    expect(spatial.getProfile().queryCount).toBe(1)
  })

  it('does not overwrite canonical aura inputs from facades', () => {
    const source = unit('canonical-source', 'attacker', 100)
    source.supportAuras = [{
      type: 'shield',
      radius: 100,
      value: 30,
      interval: 10,
      target: 'allies',
      targetTags: ['infantry'],
    }]
    const ally = unit('canonical-ally', 'attacker', 150)
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(source, ally)
    runtime.flushStructuralCommands()
    source.supportAuras = undefined
    source.x = 900
    ally.x = 900
    ally.shield = 30
    ally.maxShield = 30
    const actions: BattleAction[] = []

    runtime.runPhase('support_aura', { tick: 0, actions })

    const allyId = runtime.world.getEntityId(ally.id)!
    expect(actions).toEqual([{
      unitId: 'canonical-source',
      type: 'shield_apply',
      targetId: 'canonical-ally',
      damage: 30,
    }])
    expect(runtime.world.stores.vitality.require(allyId)).toMatchObject({
      shield: 30,
      maxShield: 30,
    })
  })
})

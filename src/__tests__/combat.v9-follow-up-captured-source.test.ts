import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getStatusDamageAttribution } from '@/domains/combat/ecs/damage-source'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'
import { recordEcsAttackTriggers } from '@/domains/combat/ecs/systems/post-hit-trigger-system'

function unit(id: string, team: 'attacker' | 'defender', x: number): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x, y: 100, currentAngle: 0 })!
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  return world
}

describe('V9 follow-up captured routing', () => {
  it('uses captured attribution when the deferred trigger source dies before drain', () => {
    const owner = unit('trigger-owner', 'attacker', 100)
    const target = unit('trigger-target', 'defender', 220)
    owner.triggerEffects = [{
      id: 'deferred-status', event: 'attack_count', count: 1,
      payload: { kind: 'status', target: 'target', status: { type: 'range_boost', duration: 10, value: 0.5 } },
      fired: false, counter: 0, cooldownRemaining: 0,
    }]
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([owner, target])

    recordEcsAttackTriggers(world, 0, 1, actions)
    world.stores.vitality.require(0).hp = 0
    world.stores.vitality.require(0).isDead = true
    drainV9FollowUps(world, { tick: 0, actions })

    const effect = world.stores.statusControl.require(1).statusEffects.find(status => status.type === 'range_boost')!
    expect(getStatusDamageAttribution(world, 1, effect)).toMatchObject({
      sourceExternalId: 'trigger-owner', sourceUnitType: 'marine', sourceTeam: 'attacker',
    })
  })

  it('skips a deferred payload whose projected target is lethal', () => {
    const attacker = unit('attacker', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    target.hp = target.maxHp = 10
    target.triggerEffects = [{
      id: 'lethal-follow-up', event: 'damage_taken', threshold: 1,
      payload: { kind: 'status', target: 'self', status: { type: 'range_boost', duration: 10, value: 0.5 } },
      fired: false, counter: 0, cooldownRemaining: 0,
    }]
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([attacker, target])

    applyEcsSingleDamage(world, 0, 1, 20, actions, { interceptable: false })
    drainV9FollowUps(world, { tick: 0, actions })

    expect(world.stores.vitality.require(1).isDead).toBe(true)
    expect(world.stores.statusControl.require(1).statusEffects).toEqual([])
    expect(actions.filter(action => action.type === 'status_apply')).toEqual([])
  })
})

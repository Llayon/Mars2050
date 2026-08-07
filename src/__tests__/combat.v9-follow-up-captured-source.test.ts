import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getStatusDamageAttribution } from '@/domains/combat/ecs/damage-source'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { applyEcsCapturedTargetMark } from '@/domains/combat/ecs/systems/target-mark-system'
import { CombatInvariantError } from '@/domains/combat/ecs/defense-batch'
import { drainV9FollowUps } from '@/domains/combat/ecs/v9-follow-up-queue'
import { commitV9ResolutionGroup } from '@/domains/combat/ecs/v9-defense-commit'
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
  it('preserves captured damage modifiers when the source disappears', () => {
    const owner = unit('trigger-owner', 'attacker', 100)
    const target = unit('trigger-target', 'defender', 220)
    owner.triggerEffects = [{
      id: 'deferred-damage', event: 'attack_count', count: 1,
      payload: { kind: 'damage', target: 'target', amount: 20 },
      fired: false, counter: 0, cooldownRemaining: 0,
    }]
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    const world = createWorld([owner, target])
    world.stores.combat.require(0).armorPierceRatio = 0.5
    world.stores.vitality.require(1).hp = 100
    world.stores.vitality.require(1).maxHp = 100
    world.stores.combat.require(1).defense = 10

    recordEcsAttackTriggers(world, 0, 1, actions)
    world.stores.vitality.require(0).isDead = true
    drainV9FollowUps(world, { tick: 0, actions })

    expect(world.stores.vitality.require(1).hp).toBe(85)
  })

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

  it('keeps squad propagation on a deferred captured mark', () => {
    const owner = unit('mark-owner', 'attacker', 100)
    const target = { ...unit('mark-target', 'defender', 220), squadId: 'squad:1' }
    const squadmate = { ...unit('mark-squadmate', 'defender', 230), squadId: 'squad:1' }
    const world = createWorld([owner, target, squadmate])
    const ledger = new EcsActionGroupLedger()
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    world.resources.set('actionGroup', ledger)
    ledger.begin(world, [0, 1, 2], { tick: 0, phaseId: 'test', groupOrdinal: 0 })

    applyEcsCapturedTargetMark(world, { sourceExternalId: 'removed-owner', sourceTeam: 'attacker', sourceUnitType: 'marine' }, 1, {
      duration: 10, damageMultiplier: 0.5, squadWide: true,
    }, actions, true, {
      originExternalId: 'ability:mark',
      position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
      targetExternalId: 'mark-target', sourceExternalId: 'removed-owner',
    })
    commitV9ResolutionGroup(world, ledger, actions)

    expect(world.stores.statusControl.require(1).targetMark?.sourceUnitId).toBe('removed-owner')
    expect(world.stores.statusControl.require(2).targetMark?.sourceUnitId).toBe('removed-owner')
  })

  it('uses a deterministic nearest-enemy tie-break', () => {
    const owner = unit('owner', 'attacker', 100)
    owner.triggerEffects = [{
      id: 'nearest', event: 'attack_count', count: 1,
      payload: { kind: 'status', target: 'nearest_enemy', status: { type: 'range_boost', duration: 5, value: 1 } },
      fired: false, counter: 0, cooldownRemaining: 0,
    }]
    const right = unit('enemy:z', 'defender', 90)
    const left = unit('enemy:a', 'defender', 110)
    const world = createWorld([owner, right, left])
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []
    recordEcsAttackTriggers(world, 0, 1, actions)
    expect(world.resources.require('v9FollowUps')[0]?.targetExternalId).toBe('enemy:a')
  })

  it('limits follow-up chain depth without limiting independent siblings', () => {
    const siblingWorld = createWorld([unit('overflow-owner', 'attacker', 100), unit('overflow-target', 'defender', 120)])
    siblingWorld.resources.set('v9FollowUps', [])
    const siblingQueue = siblingWorld.resources.require('v9FollowUps')
    for (let index = 0; index < 100; index += 1) {
      siblingQueue.push({
        ownerExternalId: 'overflow-owner', targetExternalId: 'overflow-target', eventTargetExternalId: 'overflow-target',
        payload: { kind: 'status', target: 'target', status: { type: 'range_boost', duration: 1, value: 1 } }, actions: [],
        followUpOrdinal: index, order: { originExternalId: `overflow:${index}`, position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: index }, targetExternalId: 'overflow-target', sourceExternalId: 'overflow-owner' },
        attribution: { sourceExternalId: 'overflow-owner', sourceTeam: 'attacker', sourceUnitType: 'marine' }, chainPath: [`overflow:${index}`],
      })
    }
    expect(() => drainV9FollowUps(siblingWorld, { tick: 0, actions: [] })).not.toThrow()
    expect(siblingQueue).toEqual([])

    const depthWorld = createWorld([unit('depth-owner', 'attacker', 100), unit('depth-target', 'defender', 120)])
    depthWorld.resources.set('v9FollowUps', [])
    const depthQueue = depthWorld.resources.require('v9FollowUps')
    depthQueue.push({
      ownerExternalId: 'depth-owner', targetExternalId: 'depth-target', eventTargetExternalId: 'depth-target',
      payload: { kind: 'status', target: 'target', status: { type: 'range_boost', duration: 1, value: 1 } }, actions: [],
      followUpOrdinal: 0, order: { originExternalId: 'depth:32', position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, targetExternalId: 'depth-target', sourceExternalId: 'depth-owner' },
      attribution: { sourceExternalId: 'depth-owner', sourceTeam: 'attacker', sourceUnitType: 'marine' },
      chainPath: Array.from({ length: 32 }, (_, index) => `depth:${index}`),
    })
    expect(() => drainV9FollowUps(depthWorld, { tick: 0, actions: [] })).not.toThrow()

    depthQueue.push({
      ownerExternalId: 'depth-owner', targetExternalId: 'depth-target', eventTargetExternalId: 'depth-target',
      payload: { kind: 'status', target: 'target', status: { type: 'range_boost', duration: 1, value: 1 } }, actions: [],
      followUpOrdinal: 0, order: { originExternalId: 'depth:33', position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, targetExternalId: 'depth-target', sourceExternalId: 'depth-owner' },
      attribution: { sourceExternalId: 'depth-owner', sourceTeam: 'attacker', sourceUnitType: 'marine' },
      chainPath: Array.from({ length: 33 }, (_, index) => `depth:${index}`),
    })
    expect(() => drainV9FollowUps(depthWorld, { tick: 0, actions: [] })).toThrow(CombatInvariantError)
  })

  it('extends the diagnostic path for nested follow-up chains', () => {
    const attacker = unit('chain-attacker', 'attacker', 100)
    const defender = unit('chain-defender', 'defender', 120)
    for (const current of [attacker, defender]) {
      current.hp = current.maxHp = 100
      current.defense = 0
      current.triggerEffects = [{
        id: `counter:${current.id}`,
        event: 'damage_taken',
        threshold: 1,
        repeatable: true,
        payload: { kind: 'damage', target: 'attacker', amount: 1 },
        fired: false,
        counter: 0,
        cooldownRemaining: 0,
      }]
    }
    const world = createWorld([attacker, defender])
    const actions: Parameters<typeof recordEcsAttackTriggers>[3] = []

    applyEcsSingleDamage(world, 0, 1, 1, actions, { interceptable: false })

    expect(() => drainV9FollowUps(world, { tick: 0, actions })).toThrowError(
      /follow-up trigger depth exceeded 32; chain=trigger:chain-defender:counter:chain-defender > trigger:chain-attacker:counter:chain-attacker/,
    )
  })
})

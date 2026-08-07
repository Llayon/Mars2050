import { describe, expect, it } from 'vitest'
import type { RuntimePhaseContext } from '@/domains/combat/combat.phase'
import type { DamageSourceContext } from '@/domains/combat/ecs/damage-source'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { PendingImpactQueue } from '@/domains/combat/ecs/pending-impacts'
import { EcsCombatPhaseScheduler } from '@/domains/combat/ecs/combat-phase-scheduler'

function sourceContext(): DamageSourceContext {
  return {
    attribution: {
      sourceExternalId: 'packet-source',
      sourceUnitType: 'missile_buggy',
      sourceTeam: 'attacker',
    },
    attack: 20,
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

function createWorld(targets: SimUnit[]): CombatWorld {
  const world = new CombatWorld(targets)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  world.resources.set('pendingImpacts', new PendingImpactQueue())
  world.resources.set('actionGroup', new EcsActionGroupLedger())
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  return world
}

function runProjectileImpactSystem(world: CombatWorld, context: RuntimePhaseContext): void {
  new EcsCombatPhaseScheduler(world).runPhase('projectile_impact', context)
}

describe('immutable temporal impact packets', () => {
  it('executes area impact programs against one frozen target set', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const first = createRuntimeUnitFromConfig({ id: 'first', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    const second = createRuntimeUnitFromConfig({ id: 'second', team: 'defender', type: 'marine', x: 115, y: 100, currentAngle: Math.PI })!
    for (const target of [first, second]) target.defense = 0
    const world = createWorld([source, first, second])
    const queue = world.resources.require('pendingImpacts')
    queue.enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      canTargetAir: true,
      canTargetGround: true,
      sourceContext: sourceContext(),
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'ground_targeted',
      positionPolicy: 'captured_at_windup',
      payload: { kind: 'area', damage: 10, radius: 50, maxTargets: 2 },
      interceptable: false,
      programs: [{
        id: 'packet-area-program',
        trigger: { kind: 'projectile_impact' },
        priority: 0,
        groups: [{
          selector: { kind: 'area_at_impact', radius: 50, maxTargets: 2 },
          effects: [
            { kind: 'damage', expression: { kind: 'fixed', amount: 5 } },
            { kind: 'apply_status', status: 'burn', duration: 5, value: 3 },
          ],
        }],
      }],
    })

    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(first.maxHp - 5)
    expect(world.stores.vitality.require(2).hp).toBe(second.maxHp - 5)
    expect(world.stores.statusControl.require(1).statusEffects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'burn', value: 3 })]))
    expect(world.stores.statusControl.require(2).statusEffects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'burn', value: 3 })]))
    expect(actions).toContainEqual(expect.objectContaining({ type: 'projectile_impact', unitId: 'packet-source' }))
  })

  it('misses a non-homing direct packet when the target leaves its captured point', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    const world = createWorld([source, target])
    world.stores.transform.require(1).x = 180
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetId: 1,
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'projectile',
      positionPolicy: 'captured_at_launch',
      payload: { kind: 'direct', damage: 20, targetId: 1 },
      interceptable: false,
    })
    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'projectile_miss', impactId: 1 }))
  })

  it('does not apply impact status after projected lethal damage', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    target.hp = 10
    const world = createWorld([source, target])
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetId: 1,
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'projectile',
      positionPolicy: 'tracked_target',
      payload: { kind: 'direct', damage: 20, targetId: 1 },
      interceptable: false,
      programs: [{
        id: 'lethal-status',
        trigger: { kind: 'projectile_impact' },
        priority: 0,
        groups: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'apply_status', status: 'burn', duration: 5, value: 3 }] }],
      }],
    })
    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).isDead).toBe(true)
    expect(world.stores.statusControl.require(1).statusEffects.some(effect => effect.type === 'burn')).toBe(false)
  })

  it('resolves a packet after the source entity is gone and preserves attribution', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    const world = createWorld([target])
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 99,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetId: 0,
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'projectile',
      positionPolicy: 'captured_at_launch',
      payload: { kind: 'direct', damage: 20, targetId: 0 },
      interceptable: false,
    })
    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(0).hp).toBe(target.maxHp - 20)
    expect(actions).toContainEqual(expect.objectContaining({ sourceUnitType: 'missile_buggy', sourceTeam: 'attacker', type: 'damage' }))
  })

  it('misses a tracked packet when the target changes to the source team', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    const world = createWorld([source, target])
    world.stores.identity.require(1).team = 'attacker'
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetId: 1,
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'projectile',
      positionPolicy: 'tracked_target',
      payload: { kind: 'direct', damage: 20, targetId: 1 },
      interceptable: false,
    })
    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'projectile_miss', impactId: 1 }))
  })

  it('resolves a tracked packet at the target position at impact time', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    const world = createWorld([source, target])
    world.stores.transform.require(1).x = 130
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetId: 1,
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'projectile',
      positionPolicy: 'tracked_target',
      payload: { kind: 'direct', damage: 20, targetId: 1 },
      interceptable: false,
    })
    const actions: RuntimePhaseContext['actions'] = []
    runProjectileImpactSystem(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp - 20)
    expect(actions).toContainEqual(expect.objectContaining({ type: 'projectile_impact', toX: 130 }))
  })
})

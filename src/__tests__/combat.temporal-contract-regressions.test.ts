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

function runScheduledProjectileImpact(world: CombatWorld, context: RuntimePhaseContext): void {
  new EcsCombatPhaseScheduler(world).runPhase('projectile_impact', context)
}

describe('combat temporal contract regressions', () => {
  it('commits a scheduled projectile impact exactly once', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
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
      positionPolicy: 'captured_at_launch',
      payload: { kind: 'direct', damage: 20, targetId: 1 },
      interceptable: false,
    })
    const actions: RuntimePhaseContext['actions'] = []

    runScheduledProjectileImpact(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp - 20)
    expect(actions.filter(action => action.type === 'damage')).toHaveLength(1)
  })

  it('validates direct target before allocating interception', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    const interceptor = createRuntimeUnitFromConfig({ id: 'interceptor', team: 'defender', type: 'shield_emitter', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    interceptor.projectileInterceptRadius = 200
    interceptor.projectileInterceptCooldown = 0
    interceptor.projectileInterceptCooldownMax = 3
    const world = createWorld([source, target, interceptor])
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
      interceptable: true,
    })
    const actions: RuntimePhaseContext['actions'] = []

    runScheduledProjectileImpact(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(actions).toContainEqual(expect.objectContaining({ type: 'projectile_miss', impactId: 1 }))
    expect(actions).not.toContainEqual(expect.objectContaining({ type: 'projectile_intercept', impactId: 1 }))
    expect(interceptor.projectileInterceptCooldown).toBe(0)
  })

  it('replaces the whole area payload when a damage program selects only one target', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const first = createRuntimeUnitFromConfig({ id: 'first', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    const second = createRuntimeUnitFromConfig({ id: 'second', team: 'defender', type: 'marine', x: 115, y: 100, currentAngle: Math.PI })!
    for (const target of [first, second]) target.defense = 0
    const world = createWorld([source, first, second])
    world.resources.require('pendingImpacts').enqueue({
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
        id: 'packet-replacement-program',
        trigger: { kind: 'projectile_impact' },
        priority: 0,
        groups: [{
          selector: { kind: 'area_at_impact', radius: 50, maxTargets: 1 },
          effects: [{ kind: 'damage', expression: { kind: 'fixed', amount: 5 } }],
        }],
      }],
    })

    runScheduledProjectileImpact(world, { tick: 1, actions: [] } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(first.maxHp - 5)
    expect(world.stores.vitality.require(2).hp).toBe(second.maxHp)
  })

  it('replaces direct payload damage when only a neighboring area target is selected', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const primary = createRuntimeUnitFromConfig({ id: 'primary', team: 'defender', type: 'marine', x: 105, y: 100, currentAngle: Math.PI })!
    const neighbor = createRuntimeUnitFromConfig({ id: 'neighbor', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    for (const target of [primary, neighbor]) target.defense = 0
    const world = createWorld([source, primary, neighbor])
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
      payload: { kind: 'direct', damage: 10, targetId: 1 },
      interceptable: false,
      programs: [{
        id: 'direct-area-program',
        trigger: { kind: 'projectile_impact' },
        priority: 0,
        groups: [{
          selector: { kind: 'area_at_impact', radius: 3, maxTargets: 1 },
          effects: [{ kind: 'damage', expression: { kind: 'fixed', amount: 5 } }],
        }],
      }],
    })

    runScheduledProjectileImpact(world, { tick: 1, actions: [] } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(primary.maxHp)
    expect(world.stores.vitality.require(2).hp).toBe(neighbor.maxHp - 5)
  })

  it('treats a zero damage effect as replacement rather than falling back to base damage', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    const world = createWorld([source, target])
    world.resources.require('pendingImpacts').enqueue({
      sourceId: 0,
      sourceExternalId: 'packet-source',
      sourceTeam: 'attacker',
      hostileTeamAtLaunch: 'defender',
      sourceContext: sourceContext(),
      targetX: 100,
      targetY: 100,
      launchTick: 0,
      impactTick: 1,
      kind: 'ground_targeted',
      positionPolicy: 'captured_at_windup',
      payload: { kind: 'area', damage: 10, radius: 20, maxTargets: 1 },
      interceptable: false,
      programs: [{
        id: 'zero-damage-program',
        trigger: { kind: 'projectile_impact' },
        priority: 0,
        groups: [{
          selector: { kind: 'area_at_impact', radius: 20, maxTargets: 1 },
          effects: [{ kind: 'damage', expression: { kind: 'fixed', amount: 0 } }],
        }],
      }],
    })

    runScheduledProjectileImpact(world, { tick: 1, actions: [] } as RuntimePhaseContext)

    expect(world.stores.vitality.require(1).hp).toBe(target.maxHp)
  })
})

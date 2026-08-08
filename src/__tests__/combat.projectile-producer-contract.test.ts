import { describe, expect, it } from 'vitest'
import type { RuntimePhaseContext } from '@/domains/combat/combat.phase'
import type { DamageSourceContext } from '@/domains/combat/ecs/damage-source'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { CombatInvariantError } from '@/domains/combat/ecs/combat-invariant-error'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { PendingImpactQueue } from '@/domains/combat/ecs/pending-impacts'
import { EcsCombatPhaseScheduler } from '@/domains/combat/ecs/combat-phase-scheduler'
import { runProjectileImpactSystem as produceProjectileImpacts } from '@/domains/combat/ecs/systems/projectile-impact-system'
import type { SimUnit } from '@/domains/combat/combat.sim.types'

function sourceContext(): DamageSourceContext {
  return {
    attribution: { sourceExternalId: 'packet-source', sourceUnitType: 'missile_buggy', sourceTeam: 'attacker' },
    attack: 20,
    modifiers: {
      attackBoostValue: 0, outputSuppression: 0, accuracyPenalty: 0, accuracyPenaltyResist: 0,
      armorPierceRatio: 0, summonCounterDamageMult: 1, shieldDamageMult: 1, lifestealMult: 0, executeThreshold: 0,
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

describe('projectile producer contract', () => {
  it('fails fast without mutating pending impacts or defense resources', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 0, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 100, y: 100, currentAngle: Math.PI })!
    const interceptor = createRuntimeUnitFromConfig({ id: 'interceptor', team: 'defender', type: 'shield_emitter', x: 100, y: 100, currentAngle: Math.PI })!
    target.defense = 0
    target.shield = 10
    target.maxShield = 10
    interceptor.projectileInterceptRadius = 200
    interceptor.projectileInterceptCooldown = 0
    interceptor.projectileInterceptCooldownMax = 3
    const world = createWorld([source, target, interceptor])
    world.queueHazardCreation({ id: 'barrier', sourceUnitId: 'emitter', team: 'defender', type: 'barrier_dome', x: 100, y: 100, radius: 100, damagePerTick: 0, duration: 10, capacity: 5, maxCapacity: 5 })
    world.flushStructuralCommands()
    const queue = world.resources.require('pendingImpacts')
    queue.enqueue({ sourceId: 0, sourceExternalId: 'packet-source', sourceTeam: 'attacker', hostileTeamAtLaunch: 'defender', sourceContext: sourceContext(), targetId: 1, targetX: 100, targetY: 100, launchTick: 0, impactTick: 1, kind: 'projectile', positionPolicy: 'captured_at_launch', payload: { kind: 'direct', damage: 20, targetId: 1 }, interceptable: true })
    const actions: RuntimePhaseContext['actions'] = []
    const initialHp = target.hp
    const initialShield = target.shield
    const barrier = world.getHazard(world.getEntityId('barrier')!)!
    const initialBarrier = { capacity: barrier.capacity, duration: barrier.duration }

    expect(() => produceProjectileImpacts(world, { tick: 1, actions } as RuntimePhaseContext)).toThrow(CombatInvariantError)
    expect(queue.size()).toBe(1)
    expect(actions).toHaveLength(0)
    expect(target.hp).toBe(initialHp)
    expect(target.shield).toBe(initialShield)
    expect(interceptor.projectileInterceptCooldown).toBe(0)
    expect(world.getHazard(world.getEntityId('barrier')!)).toMatchObject(initialBarrier)

    runScheduledProjectileImpact(world, { tick: 1, actions } as RuntimePhaseContext)

    expect(queue.size()).toBe(0)
    expect(actions.filter(action => action.type === 'projectile_impact' || action.type === 'projectile_intercept')).toHaveLength(1)
    expect(actions.filter(action => action.type === 'projectile_intercept')).toHaveLength(1)
  })
})

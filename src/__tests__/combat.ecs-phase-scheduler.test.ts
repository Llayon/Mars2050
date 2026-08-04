import { describe, expect, it } from 'vitest'
import { getEcsPhaseOrder } from '@/domains/combat/ecs/combat-phase-scheduler'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { PRNG } from '@/domains/combat/combat.utils'

describe('combat ECS phase scheduler', () => {
  it('publishes the deterministic pre-action order', () => {
    expect(getEcsPhaseOrder('pre_action')).toEqual([
      'reassembly',
      'global_effect',
      'support_aura',
      'growth_charge',
      'burrow_regeneration',
      'transform_mode',
      'field_effect',
      'formation_bonus',
      'control_beam',
      'periodic_ability',
      'structural_flush',
      'status',
    ])
  })

  it('publishes the deterministic post-action order', () => {
    expect(getEcsPhaseOrder('post_action')).toEqual([
      'batch_movement',
      'projectile_impact',
      'hazard',
      'hp_threshold_trigger',
    ])
  })

  it('owns the complete actor-turn stage', () => {
    expect(getEcsPhaseOrder('action')).toEqual(['actor_turn'])
  })

  it('matches explicit phase execution and stage execution', () => {
    const staged = createEcsCombatRuntime()
    const explicit = createEcsCombatRuntime()
    const source = createRuntimeUnitFromConfig({
      id: 'officer', team: 'attacker', type: 'officer', x: 100, y: 100, currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target', team: 'defender', type: 'marine', x: 180, y: 100, currentAngle: Math.PI,
    })!
    target.statusEffects.push({
      type: 'burn', duration: 10, value: 2, tickInterval: 10, nextTickIn: 1,
    })
    for (const runtime of [staged, explicit]) {
      runtime.world.queueUnitCreation(structuredClone(source), structuredClone(target))
      runtime.flushStructuralCommands()
    }
    const stagedActions: Parameters<typeof staged.runStage>[1]['actions'] = []
    const explicitActions: Parameters<typeof explicit.runPhase>[1]['actions'] = []
    staged.runStage('pre_action', {
      tick: 0, actions: stagedActions, rng: new PRNG(17), activeGlobals: [],
    })
    const explicitContext = {
      tick: 0, actions: explicitActions, rng: new PRNG(17), activeGlobals: [],
    }
    for (const phaseId of getEcsPhaseOrder('pre_action')) {
      explicit.runPhase(phaseId, explicitContext)
    }

    expect(stagedActions).toEqual(explicitActions)
    expect(staged.snapshotUnits()).toEqual(explicit.snapshotUnits())
  })

  it('rejects random phases without a seeded RNG', () => {
    const runtime = createEcsCombatRuntime()
    const source = createRuntimeUnitFromConfig({
      id: 'source', team: 'attacker', type: 'marine', x: 100, y: 100, currentAngle: 0,
    })!
    source.periodicAbilities = [{
      id: 'pulse', intervalTicks: 10, nextTick: 0,
      payload: { kind: 'heal', amount: 1 },
    }]
    runtime.world.queueUnitCreation(source)
    runtime.flushStructuralCommands()

    expect(() => runtime.runPhase('periodic_ability', { tick: 0, actions: [] }))
      .toThrow('requires seeded RNG')
  })
})

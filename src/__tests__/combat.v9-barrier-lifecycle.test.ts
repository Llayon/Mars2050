import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { commitV9ResolutionGroup } from '@/domains/combat/ecs/v9-defense-commit'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'
import { runHazardSystem } from '@/domains/combat/ecs/systems/hazard-system'

function unit(id: string, team: 'attacker' | 'defender', x: number): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x, y: 100, currentAngle: 0 })!
}

function beginWorld(capacity: number): { world: CombatWorld; ledger: EcsActionGroupLedger; actions: ReturnType<typeof createActions> } {
  const world = new CombatWorld([unit('attacker', 'attacker', 100), unit('target', 'defender', 106)])
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  world.queueHazardCreation({
    id: 'barrier:expiry', team: 'defender', type: 'barrier_dome', x: 106, y: 100,
    radius: 100, damagePerTick: 0, duration: 1, capacity, maxCapacity: capacity,
  })
  world.flushStructuralCommands()
  const ledger = new EcsActionGroupLedger()
  world.resources.set('actionGroup', ledger)
  ledger.begin(world, [0, 1], { tick: 0, phaseId: 'test', groupOrdinal: 0 })
  return { world, ledger, actions: createActions() }
}

function createActions() {
  return [] as Parameters<typeof applyEcsSingleDamage>[4]
}

describe('V9 barrier lifecycle', () => {
  it('emits one expire for a duration-only barrier with zero capacity', () => {
    const { world, ledger, actions } = beginWorld(0)
    runHazardSystem(world, actions, () => undefined)
    commitV9ResolutionGroup(world, ledger, actions)
    world.flushStructuralCommands()

    expect(actions.filter(action => action.type === 'barrier_expire')).toHaveLength(1)
    expect(actions.filter(action => action.type === 'barrier_break')).toHaveLength(0)
    expect(world.snapshotHazards()).toEqual([])
  })

  it('prioritizes one break over expiration in the same group', () => {
    const { world, ledger, actions } = beginWorld(10)
    runHazardSystem(world, actions, () => undefined)
    applyEcsSingleDamage(world, 0, 1, 20, actions, { allowPercentHpDamage: false, interceptable: false })
    commitV9ResolutionGroup(world, ledger, actions)
    world.flushStructuralCommands()

    expect(actions.filter(action => action.type === 'barrier_break')).toHaveLength(1)
    expect(actions.filter(action => action.type === 'barrier_expire')).toHaveLength(0)
    expect(world.snapshotHazards()).toEqual([])
  })
})

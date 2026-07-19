import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

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
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function preparePending(unit: SimUnit): void {
  unit.hp = 0
  unit.isDead = true
  unit.actionCooldown = 7
  unit.statusEffects = [{
    type: 'burn',
    duration: 20,
    tickInterval: 10,
    nextTickIn: 10,
  }]
  unit.targetMark = {
    sourceUnitId: 'enemy',
    duration: 10,
    damageMultiplier: 0.5,
  }
  unit.controlProgress = {
    sourceUnitId: 'enemy',
    sourceTeam: unit.team === 'attacker' ? 'defender' : 'attacker',
    progress: 3,
    threshold: 5,
    breakOnCleanse: true,
  }
  unit.reassemblyState = {
    remainingTicks: 2,
    hpPercent: 0.5,
    sourceUnitId: unit.id,
  }
}

describe('combat ECS reassembly phase', () => {
  it('matches legacy timing, reset state, and replay output', () => {
    const pending = unit('pending', 'attacker', 100)
    preparePending(pending)
    const restoredHp = Math.max(1, Math.floor(pending.maxHp * 0.5))
    const enemy = unit('enemy', 'defender', 500)
    const legacy = createLegacyCombatRuntime()
    const ecs = createEcsCombatRuntime()
    legacy.units.push(structuredClone(pending), structuredClone(enemy))
    ecs.units.push(structuredClone(pending), structuredClone(enemy))
    ecs.flushStructuralCommands()
    const legacyActions: BattleAction[] = []
    const ecsActions: BattleAction[] = []

    legacy.runReassemblyPhase(legacyActions)
    ecs.runReassemblyPhase(ecsActions)
    expect(ecs.getTerminalOutcome()).toBeNull()
    legacy.runReassemblyPhase(legacyActions)
    ecs.runReassemblyPhase(ecsActions)

    expect(ecsActions).toEqual(legacyActions)
    expect(ecs.snapshotUnits()).toEqual(legacy.snapshotUnits())
    expect(ecs.world.snapshotEntity(0)).toMatchObject({
      hp: restoredHp,
      isDead: false,
      actionCooldown: 0,
      statusEffects: [],
      targetMark: undefined,
      controlProgress: undefined,
      reassemblyState: undefined,
    })
  })

  it('reads pending elimination protection from canonical vitality state', () => {
    const dead = unit('dead', 'attacker', 100)
    dead.hp = 0
    dead.isDead = true
    const enemy = unit('enemy', 'defender', 500)
    const runtime = createEcsCombatRuntime()
    runtime.units.push(dead, enemy)
    runtime.flushStructuralCommands()
    runtime.world.stores.vitality.require(0).reassemblyState = {
      remainingTicks: 2,
      hpPercent: 1,
      sourceUnitId: 'dead',
    }

    expect(runtime.units[0].reassemblyState).toBeUndefined()
    expect(runtime.getTerminalOutcome()).toBeNull()
  })
})

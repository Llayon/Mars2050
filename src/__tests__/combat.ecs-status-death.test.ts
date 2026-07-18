import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { resolveUnitDeath } from '@/domains/combat/combat.death'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function unit(id: string, team: 'attacker' | 'defender'): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x: team === 'attacker' ? 100 : 200,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function runLegacyStatus(units: SimUnit[], actions: BattleAction[]): void {
  const runtime = createLegacyCombatRuntime()
  runtime.units.push(...units)
  const rng = new PRNG(107)
  runtime.runStatusPhase(actions, (dead, sourceUnitId, cause) => {
    const source = sourceUnitId
      ? runtime.units.find(candidate => candidate.id === sourceUnitId)
      : undefined
    resolveUnitDeath(dead, source, cause, {
      units: runtime.units,
      hazards: runtime.hazards,
      actions,
      rng,
    })
  })
}

describe('combat ECS status death', () => {
  it('matches sourced burn death and native death-trigger effects', () => {
    const attacker = unit('burner', 'attacker')
    const target = unit('target', 'defender')
    target.hp = 5
    target.statusEffects = [
      normalizeStatusEffect({
        type: 'burn',
        duration: 1,
        value: 10,
        tickInterval: 1,
        sourceUnitId: attacker.id,
      }),
    ]
    target.triggerEffects = [{
      id: 'last-shield',
      event: 'death',
      payload: { kind: 'shield', target: 'killer', amount: 15 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: BattleAction[] = []
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(attacker, target)
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(107))

    runLegacyStatus(legacyUnits, legacyActions)
    runtime.runStatusPhase(nativeActions, () => {
      throw new Error('ECS status death used the facade callback')
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(runtime.world.snapshot()).toEqual(legacyUnits)
    expect(nativeActions.at(-1)).toEqual({
      unitId: 'target',
      type: 'status_expire',
      statusType: 'burn',
    })
    expect(runtime.world.stores.vitality.require(0).shield).toBe(15)
  })

  it('matches source-less degeneration without kill credit', () => {
    const target = unit('decaying', 'defender')
    target.hp = 3
    target.statusEffects = [
      normalizeStatusEffect({
        type: 'degeneration',
        duration: 2,
        value: 5,
        tickInterval: 1,
      }),
    ]
    const legacyUnits = structuredClone([target])
    const legacyActions: BattleAction[] = []
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(target)
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(109))

    runLegacyStatus(legacyUnits, legacyActions)
    runtime.runStatusPhase(nativeActions, () => {
      throw new Error('ECS status death used the facade callback')
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions).toContainEqual({
      unitId: 'decaying',
      type: 'die',
      cause: 'degeneration',
    })
    expect(nativeActions.some(action => action.type === 'on_kill')).toBe(false)
    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
  })
})

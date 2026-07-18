import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { runEcsTransformModeSystem } from '@/domains/combat/ecs/systems'

function unit(id: string, team: 'attacker' | 'defender' = 'attacker'): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x: 100,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS transform mode phase', () => {
  it('matches legacy role swaps, thresholds, flight, and jumps', () => {
    const assault = unit('assault')
    assault.transformMode = [{
      id: 'assault-mode',
      mode: 'assault',
      trigger: 'battle_start',
      hpMult: 1.2,
      attackMult: 1.5,
      speedMult: 1.1,
      rangeMult: 0.5,
      cooldownMult: 0.5,
      aoeRadiusAdd: 30,
      isFlying: true,
      canTargetAir: true,
    }]
    assault.transformState = { appliedIds: [] }
    const jumper = unit('jumper', 'defender')
    jumper.hp = Math.floor(jumper.maxHp * 0.7)
    jumper.transformMode = [{
      id: 'threshold-jump',
      mode: 'jump',
      trigger: 'hp_threshold',
      hpThreshold: 0.8,
      jumpDistance: 120,
    }]
    jumper.transformState = { appliedIds: [] }

    const legacy = createLegacyCombatRuntime()
    const ecs = createEcsCombatRuntime()
    for (const candidate of [assault, jumper]) {
      legacy.units.push(structuredClone(candidate))
      ecs.units.push(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const legacyActions: BattleAction[] = []
    const ecsActions: BattleAction[] = []

    legacy.runTransformModePhase(0, legacyActions)
    ecs.runTransformModePhase(0, ecsActions)
    legacy.runTransformModePhase(1, legacyActions)
    ecs.runTransformModePhase(1, ecsActions)

    expect(ecsActions).toEqual(legacyActions)
    expect(ecs.snapshotUnits()).toEqual(legacy.snapshotUnits())
    expect(ecsActions.map(action => action.unitId)).toEqual(['assault', 'jumper'])
  })

  it('reads canonical stores in stable external-ID order', () => {
    const world = new CombatWorld([unit('zeta'), unit('alpha')])
    for (const entityId of [0, 1]) {
      const status = world.stores.statusControl.require(entityId)
      status.transformMode = [{
        id: 'canonical',
        mode: 'assault',
        trigger: 'battle_start',
        attackMult: 2,
      }]
      status.transformState = { appliedIds: [] }
    }
    const actions: BattleAction[] = []

    expect(world.roster.every(candidate => !candidate.transformMode)).toBe(true)
    runEcsTransformModeSystem(world, 0, actions)

    expect(actions.map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.combat.require(0).attack)
      .toBeGreaterThan(world.roster[0].attack)
    expect(world.stores.statusControl.require(0).transformState?.appliedIds)
      .toEqual(['canonical'])
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { GLOBAL_UPGRADES } from '@/domains/combat/combat.upgrades'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { runEcsGlobalEffectSystem } from '@/domains/combat/ecs/systems'

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
    y: 500,
    currentAngle: 0,
  })!
}

const activeGlobals = [
  { team: 'attacker' as const, upg: GLOBAL_UPGRADES.mass_shield },
  { team: 'attacker' as const, upg: GLOBAL_UPGRADES.global_emp },
  { team: 'attacker' as const, upg: GLOBAL_UPGRADES.orbital_strike },
  { team: 'attacker' as const, upg: GLOBAL_UPGRADES.mass_heal },
]

describe('combat ECS global effect phase', () => {
  it('matches legacy shield, EMP, orbital strike, and actual mass healing', () => {
    const attacker = unit('attacker', 'attacker', 100)
    attacker.hp = Math.max(1, attacker.maxHp - 20)
    const firstEnemy = unit('enemy-a', 'defender', 300)
    const secondEnemy = unit('enemy-b', 'defender', 500)
    const legacy = createLegacyCombatRuntime()
    const ecs = createEcsCombatRuntime()
    for (const candidate of [attacker, secondEnemy, firstEnemy]) {
      legacy.units.push(structuredClone(candidate))
      ecs.units.push(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const legacyActions: BattleAction[] = []
    const ecsActions: BattleAction[] = []
    const legacyRng = new PRNG(17)
    const ecsRng = new PRNG(17)

    for (const tick of [0, 50, 100, 150]) {
      legacy.runGlobalEffectPhase(
        tick,
        activeGlobals,
        legacyActions,
        legacyRng,
      )
      ecs.runGlobalEffectPhase(tick, activeGlobals, ecsActions, ecsRng)
    }

    expect(ecsActions).toEqual(legacyActions)
    expect(ecs.snapshotUnits()).toEqual(legacy.snapshotUnits())
    expect(ecs.hazards).toEqual(legacy.hazards)
    expect(ecsActions).toContainEqual({
      unitId: 'system',
      type: 'heal',
      targetId: 'attacker',
      damage: 20,
    })
  })

  it('mutates canonical vitality and status components directly', () => {
    const world = new CombatWorld([
      unit('ally', 'attacker', 100),
      unit('enemy', 'defender', 200),
    ])
    world.stores.statusControl.require(1).statusEffects = []
    const actions: BattleAction[] = []

    runEcsGlobalEffectSystem(
      world,
      0,
      [activeGlobals[0]],
      actions,
      new PRNG(1),
    )
    runEcsGlobalEffectSystem(
      world,
      50,
      [activeGlobals[1]],
      actions,
      new PRNG(1),
    )

    expect(world.stores.vitality.require(0).shield).toBeGreaterThan(0)
    expect(world.stores.statusControl.require(1).statusEffects)
      .toContainEqual(expect.objectContaining({ type: 'emp' }))
    expect(world.roster[0].shield).toBe(0)
    expect(world.roster[1].statusEffects).toEqual([])
  })
})

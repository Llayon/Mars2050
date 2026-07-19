import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { GLOBAL_UPGRADES } from '@/domains/combat/combat.upgrades'
import { normalizeStatusEffect } from '@/domains/combat/combat.status'
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
  it('applies shield, EMP, orbital strike, and actual mass healing', () => {
    const attacker = unit('attacker', 'attacker', 100)
    attacker.hp = Math.max(1, attacker.maxHp - 20)
    const firstEnemy = unit('enemy-a', 'defender', 300)
    const secondEnemy = unit('enemy-b', 'defender', 500)
    const ecs = createEcsCombatRuntime()
    for (const candidate of [attacker, secondEnemy, firstEnemy]) {
      ecs.world.roster.push(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []
    const ecsRng = new PRNG(17)

    for (const tick of [0, 50, 100, 150]) {
      ecs.runGlobalEffectPhase(tick, activeGlobals, ecsActions, ecsRng)
    }

    expect(ecsActions).toContainEqual({
      unitId: 'system',
      type: 'heal',
      targetId: 'attacker',
      damage: 20,
    })
    expect(ecsActions).toContainEqual(expect.objectContaining({
      unitId: 'system',
      type: 'hazard_spawn',
    }))
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

  it('does not overwrite canonical global-effect inputs from facades', () => {
    const ally = unit('canonical-ally', 'attacker', 100)
    ally.hp = ally.maxHp - 20
    const enemy = unit('canonical-enemy', 'defender', 300)
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(ally, enemy)
    runtime.flushStructuralCommands()
    ally.hp = ally.maxHp
    enemy.x = 900
    enemy.statusEffects = [normalizeStatusEffect({
      type: 'burn',
      duration: 20,
      tickInterval: 10,
    })]
    const actions: BattleAction[] = []

    runtime.runGlobalEffectPhase(50, activeGlobals, actions, new PRNG(23))
    runtime.runGlobalEffectPhase(100, activeGlobals, actions, new PRNG(23))
    runtime.runGlobalEffectPhase(150, activeGlobals, actions, new PRNG(23))

    const allyId = runtime.world.getEntityId(ally.id)!
    const enemyId = runtime.world.getEntityId(enemy.id)!
    expect(actions).toContainEqual({
      unitId: 'system',
      type: 'heal',
      targetId: 'canonical-ally',
      damage: 20,
    })
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'system',
      type: 'hazard_spawn',
      toX: 300,
    }))
    expect(runtime.world.stores.vitality.require(allyId).hp).toBe(ally.maxHp)
    expect(runtime.world.stores.statusControl.require(enemyId).statusEffects)
      .toEqual([expect.objectContaining({ type: 'emp' })])
    expect(runtime.world.roster[1].statusEffects)
      .toEqual([expect.objectContaining({ type: 'emp' })])
  })
})

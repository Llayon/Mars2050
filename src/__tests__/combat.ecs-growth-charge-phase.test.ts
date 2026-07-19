import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { runEcsGrowthAndChargeSystem } from '@/domains/combat/ecs/systems'

function unit(id: string): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x: 100,
    y: 100,
    currentAngle: 0,
  })!
}

function configure(unit: SimUnit): void {
  unit.hp = Math.max(1, unit.maxHp - 10)
  unit.statGrowth = {
    intervalTicks: 2,
    maxStacks: 2,
    attackMultPerStack: 0.5,
    hpMultPerStack: 0.1,
    nextTick: 2,
    stacks: 0,
  }
  unit.attackCharge = {
    intervalTicks: 1,
    maxStacks: 3,
    attackMultPerStack: 0.25,
    nextTick: 1,
    stacks: 0,
  }
}

describe('combat ECS growth and charge phase', () => {
  it('caps accumulation through the runtime boundary', () => {
    const growing = unit('growing')
    configure(growing)
    const ecs = createEcsCombatRuntime()
    ecs.world.roster.push(structuredClone(growing))
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    for (let tick = 0; tick <= 6; tick++) {
      ecs.runGrowthAndChargePhase(tick, ecsActions)
    }

    expect(ecs.world.stores.lifecycle.require(0)).toMatchObject({
      statGrowth: expect.objectContaining({ stacks: 2 }),
      attackCharge: expect.objectContaining({ stacks: 3 }),
    })
    expect(ecsActions.filter(action => action.type === 'stat_growth')).toHaveLength(2)
    expect(ecsActions.filter(action => action.type === 'attack_charge')).toHaveLength(3)
  })

  it('reads canonical stores in stable external-ID order', () => {
    const world = new CombatWorld([unit('zeta'), unit('alpha')])
    for (const entityId of [0, 1]) {
      const lifecycle = world.stores.lifecycle.require(entityId)
      lifecycle.statGrowth = {
        intervalTicks: 1,
        maxStacks: 1,
        attackMultPerStack: 0.5,
        nextTick: 1,
        stacks: 0,
      }
      lifecycle.attackCharge = {
        intervalTicks: 1,
        maxStacks: 1,
        attackMultPerStack: 0.25,
        nextTick: 1,
        stacks: 0,
      }
    }
    const actions: BattleAction[] = []

    expect(world.roster.every(candidate => !candidate.statGrowth)).toBe(true)
    runEcsGrowthAndChargeSystem(world, 1, actions)

    expect(actions.map(action => `${action.unitId}:${action.type}`)).toEqual([
      'alpha:stat_growth',
      'alpha:attack_charge',
      'zeta:stat_growth',
      'zeta:attack_charge',
    ])
    expect(world.stores.combat.require(0).attack)
      .toBeGreaterThan(world.roster[0].attack)
  })

  it('does not overwrite canonical growth state from the runtime facade', () => {
    const growing = unit('canonical-growth')
    configure(growing)
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(growing)
    runtime.flushStructuralCommands()
    growing.attack = 999
    growing.statGrowth = undefined
    growing.attackCharge = undefined
    const actions: BattleAction[] = []

    runtime.runGrowthAndChargePhase(2, actions)

    const entityId = runtime.world.getEntityId(growing.id)!
    expect(actions.map(action => action.type)).toEqual([
      'stat_growth',
      'attack_charge',
    ])
    expect(runtime.world.stores.combat.require(entityId).attack).toBeLessThan(999)
  })
})

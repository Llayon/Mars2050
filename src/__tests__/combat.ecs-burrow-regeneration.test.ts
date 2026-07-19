import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { runEcsBurrowRegenerationSystem } from '@/domains/combat/ecs/systems'

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

describe('combat ECS burrow regeneration', () => {
  it('records actual healing through the runtime boundary', () => {
    const burrowed = unit('burrowed')
    burrowed.hp = burrowed.maxHp - 3
    burrowed.isBurrowed = true
    burrowed.burrowConfig = {
      damageReduction: 0.4,
      regenPercentPerTick: 0.2,
    }
    const ecs = createEcsCombatRuntime()
    ecs.world.queueUnitCreation(structuredClone(burrowed))
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    ecs.runBurrowRegenerationPhase(ecsActions)

    expect(ecsActions).toEqual([{
      unitId: 'burrowed',
      type: 'burrow_regen',
      targetId: 'burrowed',
      damage: 3,
    }])
    expect(ecs.world.stores.vitality.require(0).hp).toBe(burrowed.maxHp)
  })

  it('reads canonical components and emits actions in external-ID order', () => {
    const zeta = unit('zeta')
    const alpha = unit('alpha')
    const world = new CombatWorld([zeta, alpha])
    for (const entityId of [0, 1]) {
      const vitality = world.stores.vitality.require(entityId)
      vitality.hp = 1
      const movement = world.stores.movement.require(entityId)
      movement.isBurrowed = true
      movement.burrowConfig = {
        damageReduction: 0.4,
        regenPercentPerTick: 0.1,
      }
    }
    const actions: BattleAction[] = []

    runEcsBurrowRegenerationSystem(world, actions)

    expect(actions.map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.vitality.require(0).hp).toBeGreaterThan(1)
    expect(world.stores.vitality.require(1).hp).toBeGreaterThan(1)
  })

  it('does not overwrite canonical burrow state from the runtime facade', () => {
    const burrowed = unit('canonical-burrow')
    burrowed.hp = burrowed.maxHp - 3
    burrowed.isBurrowed = true
    burrowed.burrowConfig = {
      damageReduction: 0.4,
      regenPercentPerTick: 0.2,
    }
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(burrowed)
    runtime.flushStructuralCommands()
    burrowed.hp = burrowed.maxHp
    burrowed.isBurrowed = false
    burrowed.burrowConfig = undefined
    const actions: BattleAction[] = []

    runtime.runBurrowRegenerationPhase(actions)

    expect(actions).toEqual([{
      unitId: 'canonical-burrow',
      type: 'burrow_regen',
      targetId: 'canonical-burrow',
      damage: 3,
    }])
    expect(burrowed.hp).toBe(burrowed.maxHp)
  })
})

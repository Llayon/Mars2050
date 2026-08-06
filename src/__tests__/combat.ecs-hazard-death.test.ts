import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimHazard, SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
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

describe('combat ECS hazard death', () => {
  it('finishes mine targets after a death trigger cleanses the mine', () => {
    const owner = unit('miner', 'attacker', 100)
    const first = unit('a-target', 'defender', 190)
    const second = unit('b-target', 'defender', 210)
    first.hp = second.hp = 5
    first.triggerEffects = [{
      id: 'mine-purge',
      event: 'death',
      payload: {
        kind: 'field',
        target: 'self',
        field: {
          id: 'purge',
          kind: 'cleanse_field',
          radius: 100,
          intervalTicks: 10,
          hazardTypes: ['mine'],
        },
      },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const mine: SimHazard = {
      id: 'mine-1',
      team: 'attacker',
      type: 'mine',
      x: 200,
      y: 100,
      radius: 40,
      damagePerTick: 10,
      duration: 5,
      sourceUnitId: owner.id,
    }
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(owner, first, second)
    runtime.world.queueHazardCreation(structuredClone(mine))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(113))

    runtime.runPhase('hazard', { tick: 0, actions: nativeActions, rng: new PRNG(113) })

    expect(nativeActions.filter(action => action.type === 'die')
      .map(action => action.unitId)).toEqual(['a-target', 'b-target'])
    expect(runtime.world.snapshotHazards()).toEqual([])
    expect(runtime.world.getEntityId(mine.id)).toBeUndefined()
    expect(runtime.world.stores.entityMeta.has(3)).toBe(false)
    expect(runtime.world.stores.vitality.require(1).isDead).toBe(true)
    expect(runtime.world.stores.vitality.require(2).isDead).toBe(true)
  })

  it('matches a source-less periodic hazard death', () => {
    const target = unit('irradiated', 'defender', 200)
    target.hp = 3
    const hazard: SimHazard = {
      id: 'radiation-1',
      team: 'attacker',
      type: 'radiation',
      x: 200,
      y: 100,
      radius: 40,
      damagePerTick: 5,
      duration: 11,
    }
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(target)
    runtime.world.queueHazardCreation(structuredClone(hazard))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(127))

    runtime.runPhase('hazard', { tick: 0, actions: nativeActions, rng: new PRNG(127) })

    expect(nativeActions).toContainEqual({
      unitId: 'irradiated',
      type: 'die',
      cause: 'hazard',
    })
    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
  })

  it('credits periodic status death from a hazard to its unit owner', () => {
    const owner = unit('smoke-owner', 'attacker', 100)
    const target = unit('burning-target', 'defender', 200)
    target.hp = 3
    const hazard: SimHazard = {
      id: 'burning-smoke',
      team: 'attacker',
      type: 'smoke',
      x: 200,
      y: 100,
      radius: 40,
      damagePerTick: 0,
      duration: 21,
      sourceUnitId: owner.id,
      statusEffects: [{ type: 'burn', duration: 10, value: 5, tickInterval: 1 }],
    }
    const actions: BattleAction[] = []
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(owner, target)
    runtime.world.queueHazardCreation(hazard)
    runtime.flushStructuralCommands()
    const rng = new PRNG(129)

    runtime.runPhase('hazard', { tick: 0, actions, rng })
    runtime.runPhase('status', { tick: 0, actions, rng })

    expect(actions).toContainEqual({
      unitId: 'burning-target',
      type: 'die',
      sourceUnitId: 'smoke-owner',
      cause: 'burn',
    })
  })

  it('does not overwrite canonical unit or hazard state from facades', () => {
    const target = unit('canonical-target', 'defender', 200)
    target.hp = 3
    const mine: SimHazard = {
      id: 'canonical-mine',
      team: 'attacker',
      type: 'mine',
      x: 200,
      y: 100,
      radius: 40,
      damagePerTick: 5,
      duration: 5,
    }
    const runtime = createEcsCombatRuntime({ defenseResolutionMode: 'v8_sequential' })
    runtime.world.queueUnitCreation(target)
    runtime.world.queueHazardCreation(mine)
    runtime.flushStructuralCommands()
    target.x = 900
    target.hp = target.maxHp
    mine.x = 900
    mine.damagePerTick = 0
    mine.duration = 0
    const actions: BattleAction[] = []

    runtime.runPhase('hazard', { tick: 0, actions, rng: new PRNG(131) })

    const targetId = runtime.world.getEntityId(target.id)!
    expect(actions).toContainEqual({
      unitId: 'canonical-mine',
      type: 'damage',
      targetId: 'canonical-target',
      damage: 5,
      hazardId: 'canonical-mine',
      damageKind: 'hazard',
    })
    expect(runtime.world.stores.vitality.require(targetId).isDead).toBe(true)
  })
})

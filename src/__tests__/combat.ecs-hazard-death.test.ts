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
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(owner, first, second)
    runtime.world.hazards.push(structuredClone(mine))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(113))

    runtime.runHazardPhase(nativeActions, new PRNG(113))

    expect(nativeActions.filter(action => action.type === 'die')
      .map(action => action.unitId)).toEqual(['a-target', 'b-target'])
    expect(runtime.world.hazards).toEqual([])
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
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(target)
    runtime.world.hazards.push(structuredClone(hazard))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(127))

    runtime.runHazardPhase(nativeActions, new PRNG(127))

    expect(nativeActions).toContainEqual({
      unitId: 'irradiated',
      type: 'die',
      cause: 'hazard',
    })
    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
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
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(target)
    runtime.world.hazards.push(mine)
    runtime.flushStructuralCommands()
    target.x = 900
    target.hp = target.maxHp
    mine.x = 900
    mine.damagePerTick = 0
    mine.duration = 0
    const actions: BattleAction[] = []

    runtime.runHazardPhase(actions, new PRNG(131))

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
    expect(runtime.world.roster[0].isDead).toBe(true)
  })
})

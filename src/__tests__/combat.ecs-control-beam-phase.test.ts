import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runEcsControlBeamSystem } from '@/domains/combat/ecs/systems'

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

describe('combat ECS control beam phase', () => {
  it('converts, heals, and clears targets for multiple units', () => {
    const hacker = unit('hacker', 'attacker', 100)
    hacker.attack = 0
    hacker.controlBeam = {
      range: 160,
      progressPerTick: 10,
      conversionThreshold: 10,
      maxTargets: 2,
      multiTargetProgressMultiplier: 0.5,
      healConvertedToMax: true,
    }
    const first = unit('first', 'defender', 160)
    first.hp = Math.max(1, first.maxHp - 10)
    first.attackTargetId = 'hacker'
    first.aggroLockTicks = 4
    first.meleeSlotTargetId = 'hacker'
    first.meleeSlotIndex = 2
    const second = unit('second', 'defender', 180)
    second.hp = Math.max(1, second.maxHp - 20)
    const ecs = createEcsCombatRuntime()
    for (const candidate of [hacker, second, first]) {
      ecs.world.queueUnitCreation(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const ecsActions: BattleAction[] = []

    ecs.runControlBeamPhase(ecsActions)
    ecs.runControlBeamPhase(ecsActions)

    expect(ecsActions.filter(action => action.type === 'control_convert')
      .map(action => action.targetId)).toEqual(['first', 'second'])
    expect(ecs.snapshotUnits().slice(1).every(candidate =>
      candidate.team === 'attacker' && candidate.hp === candidate.maxHp,
    )).toBe(true)
  })

  it('reads canonical beam configs and uses local queries in source order', () => {
    const world = new CombatWorld([
      unit('zeta', 'attacker', 100),
      unit('alpha', 'attacker', 120),
      unit('target', 'defender', 180),
    ])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    for (const entityId of [0, 1]) {
      world.stores.targeting.require(entityId).controlBeam = {
        range: 120,
        progressPerTick: 2,
        conversionThreshold: 20,
      }
      world.setUnitCapability(entityId, 'controlBeamCapability', true)
    }
    spatial.rebuild(world)
    const actions: BattleAction[] = []

    runEcsControlBeamSystem(world, actions)

    expect(actions.filter(action => action.type === 'control_progress')
      .map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.targeting.require(2).controlProgress)
      .toMatchObject({ sourceUnitId: 'zeta', progress: 2 })
    expect(spatial.getProfile().queryCount).toBe(2)
  })

  it('does not overwrite canonical control inputs from facades', () => {
    const hacker = unit('canonical-hacker', 'attacker', 100)
    hacker.controlBeam = {
      range: 120,
      progressPerTick: 10,
      conversionThreshold: 10,
      healConvertedToMax: true,
    }
    const target = unit('canonical-target', 'defender', 180)
    target.hp = target.maxHp - 10
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(hacker, target)
    runtime.flushStructuralCommands()
    hacker.controlBeam = undefined
    hacker.x = 800
    target.x = 950
    target.hp = target.maxHp
    const actions: BattleAction[] = []

    runtime.runControlBeamPhase(actions)

    const targetId = runtime.world.getEntityId(target.id)!
    expect(actions).toContainEqual({
      unitId: 'canonical-hacker',
      type: 'control_convert',
      targetId: 'canonical-target',
    })
    expect(actions).toContainEqual({
      unitId: 'canonical-hacker',
      type: 'heal',
      targetId: 'canonical-target',
      damage: 10,
    })
    expect(runtime.world.stores.identity.require(targetId).team).toBe('attacker')
  })
})

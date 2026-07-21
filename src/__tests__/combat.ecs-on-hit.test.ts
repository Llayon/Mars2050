import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import {
  applyEcsStatus,
  runActionSystem,
} from '@/domains/combat/ecs/systems'

function actionContext() {
  return { rng: new PRNG(1), tick: 0 }
}

describe('combat ECS on-hit effects', () => {
  it('applies squad-wide scout marks and clears allied focus locks', () => {
    const scout = createRuntimeUnitFromConfig({
      id: 'scout',
      team: 'attacker',
      type: 'scout_drone',
      x: 10,
      y: 20,
      currentAngle: 0,
    })!
    const ally = createRuntimeUnitFromConfig({
      id: 'ally',
      team: 'attacker',
      type: 'marine',
      x: 20,
      y: 40,
      currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const squadmate = createRuntimeUnitFromConfig({
      id: 'squadmate',
      team: 'defender',
      type: 'marine',
      x: 120,
      y: 20,
      currentAngle: Math.PI,
    })!
    target.squadId = 'defender-squad'
    squadmate.squadId = 'defender-squad'
    ally.attackTargetId = target.id
    ally.aggroLockTicks = 8
    const world = new CombatWorld([scout, ally, target, squadmate])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 2, actions, actionContext())

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.statusControl.require(2).targetMark).toMatchObject({
      sourceUnitId: 'scout',
      damageMultiplier: 1.25,
      squadWide: true,
    })
    expect(world.stores.statusControl.require(3).targetMark).toEqual(
      world.stores.statusControl.require(2).targetMark,
    )
    expect(world.stores.targeting.require(1).aggroLockTicks).toBe(0)
    expect(world.stores.entityTargets.require(1).attackTarget).toBeUndefined()
    expect(world.snapshotEntity(1).attackTargetId).toBeUndefined()
    expect(actions).toEqual([
      { unitId: 'scout', type: 'attack', targetId: 'target' },
      { unitId: 'scout', type: 'target_mark', targetId: 'target', value: 1.25 },
    ])
  })

  it('preserves normalized hack control mode in native replay', () => {
    const hacker = createRuntimeUnitFromConfig({
      id: 'hacker',
      team: 'attacker',
      type: 'hacker_rover',
      x: 10,
      y: 20,
      currentAngle: 0,
    })!
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([hacker, target])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, actionContext())

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.statusControl.require(1).statusEffects).toContainEqual(
      expect.objectContaining({ type: 'hacked', duration: 20, controlMode: 'redirect' }),
    )
    expect(actions).toEqual([
      { unitId: 'hacker', type: 'attack', targetId: 'target' },
      {
        unitId: 'target',
        type: 'status_apply',
        statusType: 'hacked',
        value: undefined,
        controlMode: 'redirect',
      },
    ])
  })

  it('uses the shared ECS immunity rule for harmful statuses', () => {
    const target = createRuntimeUnitFromConfig({
      id: 'target',
      team: 'defender',
      type: 'marine',
      x: 100,
      y: 20,
      currentAngle: Math.PI,
    })!
    const world = new CombatWorld([target])
    const actions: Parameters<typeof applyEcsStatus>[3] = []

    applyEcsStatus(world, 0, { type: 'status_immunity', duration: 10 }, actions)
    applyEcsStatus(world, 0, { type: 'burn', duration: 20, value: 4 }, actions)

    expect(world.stores.statusControl.require(0).statusEffects.map(effect => effect.type))
      .toEqual(['status_immunity'])
    expect(actions.map(action => action.type)).toEqual(['status_apply', 'status_immune'])
  })
})

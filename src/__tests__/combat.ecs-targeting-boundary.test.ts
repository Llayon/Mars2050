import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import {
  createEcsMeleeEngagementState,
  runActionSystem,
  runTargetingSystem,
} from '@/domains/combat/ecs/systems'
import { PRNG } from '@/domains/combat/combat.utils'

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
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

describe('combat ECS targeting boundary', () => {
  it('does not overwrite canonical targeting inputs from facades', () => {
    const attacker = unit('canonical-attacker', 'attacker', 100)
    const near = unit('canonical-near', 'defender', 200)
    const far = unit('canonical-far', 'defender', 500)
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(attacker, near, far)
    runtime.flushStructuralCommands()
    attacker.x = 900
    near.x = 0
    near.isDead = true
    far.x = 850

    runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)
    const attackerId = runtime.world.getEntityId(attacker.id)!
    const nearId = runtime.world.getEntityId(near.id)!
    const targetId = runTargetingSystem(
      runtime.world, attackerId, createEcsMeleeEngagementState(),
    )
    expect(targetId).toBe(nearId)
    expect(runtime.world.stores.vitality.require(nearId).isDead).toBe(false)
    expect(runtime.world.stores.entityTargets.require(attackerId).attackTarget).toBe(nearId)
    expect(runtime.world.snapshotEntity(attackerId).attackTargetId).toBe('canonical-near')
  })

  it('includes a designated squad inside the extended assist radius', () => {
    const ally = unit('ally', 'attacker', 100)
    const localTarget = unit('local-target', 'defender', 300)
    const markedTarget = unit('marked-target', 'defender', 400)
    const scout = createRuntimeUnitFromConfig({
      id: 'scout',
      team: 'attacker',
      type: 'scout_drone',
      x: 350,
      y: 500,
      currentAngle: 0,
    })!
    localTarget.squadId = 'local-squad'
    markedTarget.squadId = 'marked-squad'
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(ally, localTarget, markedTarget, scout)
    runtime.flushStructuralCommands()
    const actions: Parameters<typeof runActionSystem>[3] = []

    runActionSystem(runtime.world, 3, 2, actions, {
      rng: new PRNG(1),
      tick: 0,
    })
    runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)
    const targetId = runTargetingSystem(
      runtime.world,
      0,
      createEcsMeleeEngagementState(),
    )

    expect(targetId).toBe(2)
    expect(runtime.world.stores.entityTargets.require(0).attackTarget).toBe(2)

    runtime.world.stores.transform.require(1).x = 150
    runtime.world.resources.require('entitySpatial').update(runtime.world, 1)
    runtime.world.stores.entityTargets.require(0).attackTarget = undefined
    runtime.world.stores.targeting.require(0).aggroLockTicks = 0
    runtime.world.resources.require('targetingRuntime').markDirty(0)

    expect(runTargetingSystem(
      runtime.world,
      0,
      createEcsMeleeEngagementState(),
    )).toBe(1)
  })
})

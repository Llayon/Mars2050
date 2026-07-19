import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
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
    runtime.units.push(attacker, near, far)
    runtime.flushStructuralCommands()
    attacker.x = 900
    near.x = 0
    near.isDead = true
    far.x = 850

    runtime.beginTargetingPhase()
    const attackerId = runtime.world.getEntityId(attacker.id)!
    const nearId = runtime.world.getEntityId(near.id)!
    const targetId = runtime.selectTarget(attackerId)
    expect(targetId).toBe(nearId)
    expect(runtime.world.stores.vitality.require(nearId).isDead).toBe(false)
    expect(runtime.world.stores.targeting.require(attackerId).attackTargetId)
      .toBe('canonical-near')
  })
})

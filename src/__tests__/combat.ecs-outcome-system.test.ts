import { describe, expect, it } from 'vitest'
import type { SimHazard, SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function passiveUnit(
  id: string,
  team: 'attacker' | 'defender',
  x: number,
): SimUnit {
  const unit = createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
  unit.attack = 0
  unit.statusOnHit = undefined
  return unit
}

function damageHazard(): SimHazard {
  return {
    id: 'active-fire',
    team: 'attacker',
    type: 'napalm',
    x: 300,
    y: 100,
    radius: 60,
    damagePerTick: 5,
    duration: 20,
  }
}

function prepareRuntime() {
  const attacker = passiveUnit('attacker', 'attacker', 100)
  const defender = passiveUnit('defender', 'defender', 500)
  const ecs = createEcsCombatRuntime()
  ecs.units.push(structuredClone(attacker), structuredClone(defender))
  ecs.flushStructuralCommands()
  return ecs
}

describe('combat ECS outcome system', () => {
  it('distinguishes stalemate from active-hazard battles', () => {
    const ecs = prepareRuntime()

    expect(ecs.getTerminalOutcome()).toEqual({
      winner: 'draw',
      reason: 'stalemate',
    })

    ecs.hazards.push(damageHazard())

    expect(ecs.getTerminalOutcome()).toBeNull()
  })

  it('reads active hazards from canonical component state', () => {
    const ecs = prepareRuntime()
    ecs.hazards.push(damageHazard())
    ecs.flushStructuralCommands()
    ecs.hazards[0].damagePerTick = 0
    const hazardId = ecs.world.getEntityId('active-fire')!

    expect(ecs.world.stores.hazard.require(hazardId).damagePerTick).toBe(5)
    expect(ecs.getTerminalOutcome()).toBeNull()
  })
})

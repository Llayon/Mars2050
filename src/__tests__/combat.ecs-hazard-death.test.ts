import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import type { SimHazard, SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { SpatialHash } from '@/domains/combat/spatial-hash'

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

function runLegacyHazards(
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
): void {
  const runtime = createLegacyCombatRuntime()
  runtime.units.push(...units)
  runtime.hazards.push(...hazards)
  const spatial = new SpatialHash()
  for (const candidate of units) spatial.insert(candidate)
  runtime.runHazardPhase(actions, spatial, new PRNG(113))
  hazards.splice(0, hazards.length, ...runtime.hazards)
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
    const legacyUnits = structuredClone([owner, first, second])
    const legacyHazards = structuredClone([mine])
    const legacyActions: BattleAction[] = []
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(owner, first, second)
    runtime.world.hazards.push(structuredClone(mine))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(113))

    runLegacyHazards(legacyUnits, legacyHazards, legacyActions)
    runtime.runHazardPhase(nativeActions, new SpatialHash(), new PRNG(113))

    expect(nativeActions).toEqual(legacyActions)
    expect(runtime.hazards).toEqual(legacyHazards)
    expect(runtime.world.snapshot()).toEqual(legacyUnits)
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
    const legacyUnits = structuredClone([target])
    const legacyHazards = structuredClone([hazard])
    const legacyActions: BattleAction[] = []
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(target)
    runtime.world.hazards.push(structuredClone(hazard))
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(127))

    runLegacyHazards(legacyUnits, legacyHazards, legacyActions)
    runtime.runHazardPhase(nativeActions, new SpatialHash(), new PRNG(127))

    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions).toContainEqual({
      unitId: 'irradiated',
      type: 'die',
      cause: 'hazard',
    })
    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
  })
})

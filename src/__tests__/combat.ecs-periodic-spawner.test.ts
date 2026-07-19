import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processSpawnerLogic } from '@/domains/combat/combat.spawner'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  type: string,
  x: number,
): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type,
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function context(seed: number) {
  return { rng: new PRNG(seed), tick: 0 }
}

function runParity(units: SimUnit[], seed: number) {
  const legacyUnits = structuredClone(units)
  const runtime = createEcsCombatRuntime()
  runtime.world.roster.push(...structuredClone(units))
  runtime.flushStructuralCommands()
  const world = runtime.world
  const legacyActions: Parameters<typeof processSpawnerLogic>[4] = []
  const nativeActions: BattleAction[] = []

  processSpawnerLogic(
    legacyUnits[0],
    legacyUnits[legacyUnits.length - 1],
    legacyUnits,
    [],
    legacyActions,
    new PRNG(seed),
  )
  runtime.processSpawner(
    0,
    units.length - 1,
    nativeActions,
    context(seed),
  )

  return { legacyUnits, world, legacyActions, nativeActions }
}

describe('combat ECS periodic spawner', () => {
  it('owns the countdown in the lifecycle component without spawning early', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.spawnerConfig = { unitType: 'scout_drone', interval: 3, timer: 2 }
    const target = unit('target', 'defender', 'marine', 500)

    const result = runParity([source, target], 11)

    expect(result.nativeActions).toEqual(result.legacyActions)
    expect(result.world.stores.lifecycle.require(0).spawnerConfig)
      .toEqual(result.legacyUnits[0].spawnerConfig)
    expect(result.world.roster).toHaveLength(2)
  })

  it('matches seeded spawn creation and preserves the primary action cooldown', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.actionCooldown = 7
    source.spawnerConfig = { unitType: 'scout_drone', interval: 4, timer: 1 }
    const target = unit('target', 'defender', 'marine', 500)

    const result = runParity([source, target], 17)

    expect(result.nativeActions).toEqual(result.legacyActions)
    expect(result.world.roster[2]).toEqual(result.legacyUnits[2])
    expect(result.world.stores.combat.require(0).actionCooldown).toBe(7)
    expect(result.world.stores.lifecycle.require(0).spawnerConfig?.timer).toBe(4)
    expect(result.world.getEntityId(result.world.roster[2].id)).toBeUndefined()

    result.world.flushStructuralCommands()
    expect(result.world.snapshot()).toEqual(result.legacyUnits)
  })

  it('matches cap blocking without replacing the primary action cooldown', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.actionCooldown = 9
    source.spawnCap = 1
    source.spawnerConfig = { unitType: 'scout_drone', interval: 5, timer: 1 }
    const summon = unit('summon', 'attacker', 'scout_drone', 140)
    summon.summonOwnerId = 'source'
    const target = unit('target', 'defender', 'marine', 500)

    const result = runParity([source, summon, target], 23)

    expect(result.nativeActions).toEqual(result.legacyActions)
    expect(result.nativeActions).toEqual([
      { unitId: 'source', type: 'spawn_blocked', value: 1 },
    ])
    expect(result.world.stores.combat.require(0).actionCooldown).toBe(9)
    expect(result.world.stores.lifecycle.require(0).spawnerConfig?.timer).toBe(5)
    expect(result.world.roster).toHaveLength(3)
  })
})

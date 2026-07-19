import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
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

function runSpawner(units: SimUnit[], seed: number) {
  const runtime = createEcsCombatRuntime()
  runtime.world.roster.push(...structuredClone(units))
  runtime.flushStructuralCommands()
  const world = runtime.world
  const nativeActions: BattleAction[] = []

  runtime.processSpawner(
    0,
    units.length - 1,
    nativeActions,
    context(seed),
  )

  return { world, nativeActions }
}

describe('combat ECS periodic spawner', () => {
  it('owns the countdown in the lifecycle component without spawning early', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.spawnerConfig = { unitType: 'scout_drone', interval: 3, timer: 2 }
    const target = unit('target', 'defender', 'marine', 500)

    const result = runSpawner([source, target], 11)

    expect(result.nativeActions).toEqual([])
    expect(result.world.stores.lifecycle.require(0).spawnerConfig)
      .toEqual({ unitType: 'scout_drone', interval: 3, timer: 1 })
    expect(result.world.roster).toHaveLength(2)
  })

  it('matches seeded spawn creation and preserves the primary action cooldown', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.actionCooldown = 7
    source.spawnerConfig = { unitType: 'scout_drone', interval: 4, timer: 1 }
    const target = unit('target', 'defender', 'marine', 500)

    const result = runSpawner([source, target], 17)

    expect(result.nativeActions).toEqual([expect.objectContaining({
      unitId: 'source',
      type: 'spawn',
      spawnType: 'scout_drone',
      spawnTeam: 'attacker',
    })])
    expect(result.world.roster[2]).toMatchObject({
      type: 'scout_drone',
      summonOwnerId: 'source',
    })
    expect(result.world.stores.combat.require(0).actionCooldown).toBe(7)
    expect(result.world.stores.lifecycle.require(0).spawnerConfig?.timer).toBe(4)
    expect(result.world.getEntityId(result.world.roster[2].id)).toBeUndefined()

    result.world.flushStructuralCommands()
    expect(result.world.snapshot()).toHaveLength(3)
    expect(result.world.snapshotEntity(2)).toEqual(result.world.roster[2])
  })

  it('matches cap blocking without replacing the primary action cooldown', () => {
    const source = unit('source', 'attacker', 'marine', 100)
    source.actionCooldown = 9
    source.spawnCap = 1
    source.spawnerConfig = { unitType: 'scout_drone', interval: 5, timer: 1 }
    const summon = unit('summon', 'attacker', 'scout_drone', 140)
    summon.summonOwnerId = 'source'
    const target = unit('target', 'defender', 'marine', 500)

    const result = runSpawner([source, summon, target], 23)

    expect(result.nativeActions).toEqual([
      { unitId: 'source', type: 'spawn_blocked', value: 1 },
    ])
    expect(result.world.stores.combat.require(0).actionCooldown).toBe(9)
    expect(result.world.stores.lifecycle.require(0).spawnerConfig?.timer).toBe(5)
    expect(result.world.roster).toHaveLength(3)
  })
})

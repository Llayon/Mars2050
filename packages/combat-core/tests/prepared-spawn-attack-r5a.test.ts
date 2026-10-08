import { describe, it, expect } from 'vitest'
import {
  simulateCombat,
  type BattleInput,
  type UnitDefinition,
} from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'
import { PRNG } from '../src/combat.utils.js'

function makeDef(id: string, extra: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
    baseStats: {
      hp: 100,
      attack: 10,
      defense: 2,
      speed: 0,
      range: 150,
      attackType: 'single',
      actionCooldownMax: 17,
      turnSpeed: 5,
      size: 'S',
      combatTags: ['organic'],
      ...extra,
    },
  }
}

function expectThrowsBeforeWorld(fn: () => void, code: string): void {
  let rngCalls = 0
  let worldQueueCalls = 0
  const origRng = PRNG.prototype.next
  const origQueue = CombatWorld.prototype.queueUnitCreation
  const origCompiled = CombatWorld.prototype.queueCompiledUnitCreation
  PRNG.prototype.next = function (this: PRNG) {
    rngCalls++
    return origRng.apply(this)
  }
  CombatWorld.prototype.queueUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueUnitCreation']>) {
    worldQueueCalls++
    return origQueue.apply(this, args)
  }
  CombatWorld.prototype.queueCompiledUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueCompiledUnitCreation']>) {
    worldQueueCalls++
    return origCompiled.apply(this, args)
  }
  try {
    let thrown: unknown = null
    try {
      fn()
    } catch (err) {
      thrown = err
    }
    expect(thrown).not.toBeNull()
    const error = thrown as { code?: string; name?: string }
    expect(error.code).toBe(code)
    expect(rngCalls).toBe(0)
    expect(worldQueueCalls).toBe(0)
  } finally {
    PRNG.prototype.next = origRng
    CombatWorld.prototype.queueUnitCreation = origQueue
    CombatWorld.prototype.queueCompiledUnitCreation = origCompiled
  }
}

describe('R5a Pass 9: Prepared late spawn attack validation', () => {
  it('rejects prepared late-summon attackType spawn with missing spawnType before world creation', () => {
    const input: BattleInput = {
      seed: 42,
      arena: { width: 600, height: 1200, tileSize: 10, obstacles: [] },
      rules: { maxTicks: 4, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fighter: makeDef('fighter', {
          periodicAbilities: [{
            id: 'summon',
            intervalTicks: 1,
            initialDelayTicks: 0,
            targetPolicy: 'self',
            payload: { kind: 'spawn', unitType: 'minion', cap: 1 },
          }],
        }),
        minion: {
          ...makeDef('minion', { attack: 0 }),
          preparedStats: { attackType: 'spawn' },
        },
        target: makeDef('target', { attack: 0 }),
      },
      units: [
        { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 100, y: 200, angle: 0 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 150, y: 200, angle: Math.PI }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_TYPE')
  })

  it('rejects prepared late-summon attackType spawn with unknown spawnType before world creation', () => {
    const input: BattleInput = {
      seed: 42,
      arena: { width: 600, height: 1200, tileSize: 10, obstacles: [] },
      rules: { maxTicks: 4, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fighter: makeDef('fighter', {
          periodicAbilities: [{
            id: 'summon',
            intervalTicks: 1,
            initialDelayTicks: 0,
            targetPolicy: 'self',
            payload: { kind: 'spawn', unitType: 'minion', cap: 1 },
          }],
        }),
        minion: {
          ...makeDef('minion', { attack: 0 }),
          preparedStats: { attackType: 'spawn', spawnType: 'nonexistent_sub_unit' },
        },
        target: makeDef('target', { attack: 0 }),
      },
      units: [
        { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 100, y: 200, angle: 0 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 150, y: 200, angle: Math.PI }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_DEFINITION')
  })

  it('accepts prepared late-summon attackType spawn with valid spawnType reference', () => {
    const input: BattleInput = {
      seed: 42,
      arena: { width: 600, height: 1200, tileSize: 10, obstacles: [] },
      rules: { maxTicks: 4, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fighter: makeDef('fighter', {
          periodicAbilities: [{
            id: 'summon',
            intervalTicks: 1,
            initialDelayTicks: 0,
            targetPolicy: 'self',
            payload: { kind: 'spawn', unitType: 'minion', cap: 1 },
          }],
        }),
        minion: {
          ...makeDef('minion', { attack: 0 }),
          preparedStats: { attackType: 'spawn', spawnType: 'sub_unit' },
        },
        sub_unit: makeDef('sub_unit', { attack: 0, hp: 50 }),
        target: makeDef('target', { attack: 0 }),
      },
      units: [
        { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 100, y: 200, angle: 0 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 150, y: 200, angle: Math.PI }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    const result = simulateCombat(input)
    expect(result.winner).toBe('draw')
    expect(result.survivors.some(u => u.type === 'minion')).toBe(true)
  })
})

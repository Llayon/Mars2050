import { describe, it, expect } from 'vitest'
import {
  simulateCombat,
  type BattleInput,
  type UnitDefinition,
} from '../src/index.js'
import { battleInputSchema } from '../src/contracts/battle.contracts.js'
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

function baseInput(): BattleInput {
  return {
    seed: 42,
    arena: { width: 600, height: 1200, tileSize: 10, obstacles: [] },
    rules: { maxTicks: 1, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      fighter: makeDef('fighter'),
      target: makeDef('target', { attack: 0 }),
    },
    units: [
      { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 100, y: 200, angle: 0 }, rank: 1, upgradeIds: [] },
      { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 150, y: 200, angle: Math.PI }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
}

describe('R5a: Prepared loadout contract and runtime propagation', () => {
  it('applies prepared hp, preserves definition cooldown when omitted, and updates maxHp', () => {
    const input = baseInput()
    input.units[0].preparedStats = { hp: 200 }
    const result = simulateCombat(input)
    expect(result.initialState[0].maxHp).toBe(200)
    expect(result.initialState[0].actionCooldownMax).toBe(17)
  })

  it('accepts valid currentHp within prepared hp boundary', () => {
    const input = baseInput()
    input.units[0].preparedStats = { hp: 200 }
    input.units[0].currentHp = 150
    const result = simulateCombat(input)
    expect(result.initialState[0].hp).toBe(150)
    expect(result.initialState[0].maxHp).toBe(200)
  })

  it('fails before world or PRNG consumption when currentHp exceeds prepared max hp', () => {
    const input = baseInput()
    input.units[0].preparedStats = { hp: 50 }
    input.units[0].currentHp = 75

    let rngCalls = 0
    let worldQueueCalls = 0
    const origRng = PRNG.prototype.next
    const origQueue = CombatWorld.prototype.queueUnitCreation
    const origCompiled = CombatWorld.prototype.queueCompiledUnitCreation
    PRNG.prototype.next = function (this: PRNG) { rngCalls++; return origRng.apply(this) }
    CombatWorld.prototype.queueUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueUnitCreation']>) {
      worldQueueCalls++
      return origQueue.apply(this, args)
    }
    CombatWorld.prototype.queueCompiledUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueCompiledUnitCreation']>) {
      worldQueueCalls++
      return origCompiled.apply(this, args)
    }

    try {
      expect(() => simulateCombat(input)).toThrowError(/exceeds max hp/)
      expect(rngCalls).toBe(0)
      expect(worldQueueCalls).toBe(0)
    } finally {
      PRNG.prototype.next = origRng
      CombatWorld.prototype.queueUnitCreation = origQueue
      CombatWorld.prototype.queueCompiledUnitCreation = origCompiled
    }
  })

  it('rejects malformed prepared shield type at schema validation before world creation', () => {
    const input = baseInput() as unknown as Record<string, unknown>
    const units = input.units as Array<Record<string, unknown>>
    units[0].preparedStats = { shield: 'bad' }

    expect(battleInputSchema.safeParse(input).success).toBe(false)
    expect(() => simulateCombat(input as unknown as BattleInput)).toThrowError(/SCHEMA_VALIDATION_ERROR/)
  })

  it('applies prepared size to compiled unit and snapshot initialState', () => {
    const input = baseInput()
    input.units[0].preparedStats = { size: 'XL' }
    const result = simulateCombat(input)
    expect(result.initialState[0].size).toBe('XL')
  })

  it('executes status effect supplied via preparedStats.statusOnHit', () => {
    const input = baseInput()
    input.units[0].preparedStats = {
      statusOnHit: [{ type: 'burn', duration: 10, value: 2 }],
    }
    const result = simulateCombat(input)
    const statusApplies = result.logs.flatMap(tick => tick.actions).filter(a => a.type === 'status_apply')
    expect(statusApplies.length).toBeGreaterThan(0)
  })

  it('accepts and applies effective negative defense from preparedStats', () => {
    const input = baseInput()
    input.units[0].preparedStats = { defense: -3 }
    const result = simulateCombat(input)
    expect(result.initialState[0].defense).toBe(-3)
  })

  it('rejects prepared XL body violating placement bounds with zero PRNG and world calls', () => {
    const input = baseInput()
    input.units[0].placement.x = 20
    input.units[0].preparedStats = { size: 'XL' }
    expectThrowsBeforeWorld(() => simulateCombat(input), /OUT_OF_BOUNDS_COORDINATES/)
  })

  it('accepts prepared S body overriding XL definition at x=20', () => {
    const input = baseInput()
    input.definitions.fighter.baseStats.size = 'XL'
    input.units[0].placement.x = 20
    input.units[0].preparedStats = { size: 'S' }
    const result = simulateCombat(input)
    expect(result.initialState[0].size).toBe('S')
    expect(result.initialState[0].x).toBe(20)
  })

  it('uses prepared radius for random placement within tight bounds', () => {
    const input = baseInput()
    input.arena = { width: 100, height: 100, tileSize: 10, obstacles: [], deployment: { depth: 100 } }
    input.units[0].placement = {}
    input.units[0].preparedStats = { size: 'XL' }
    input.units[1].placement = { x: 50, y: 50 }
    const result = simulateCombat(input)
    const first = result.initialState[0]
    expect(first.size).toBe('XL')
    expect(first.x).toBeGreaterThanOrEqual(45)
    expect(first.x).toBeLessThanOrEqual(55)
    expect(first.y).toBeGreaterThanOrEqual(45)
    expect(first.y).toBeLessThanOrEqual(55)
  })

  it('rejects prepared weapon geometry conflict before world creation', () => {
    const input = baseInput()
    input.definitions.fighter.baseStats.linePierce = { width: 12, damageMultiplier: 1 }
    input.units[0].preparedStats = { attackType: 'aoe', aoeRadius: 20 }
    expectThrowsBeforeWorld(() => simulateCombat(input), /SCHEMA_VALIDATION_ERROR/)
  })

  it('rejects prepared invalid periodic ability payload before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = {
      periodicAbilities: [{ id: 'bad-periodic', intervalTicks: 1, payload: { kind: 'made_up' } }],
    }
    expectThrowsBeforeWorld(() => simulateCombat(input), /SCHEMA_VALIDATION_ERROR/)
  })

  it('rejects prepared missing spawn reference before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = { attackType: 'spawn', spawnType: 'missing', spawnCap: 1 }
    expectThrowsBeforeWorld(() => simulateCombat(input), /MISSING_SPAWN_DEFINITION/)
  })

  it('rejects prepared unknown targeting profile before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = { targetingProfile: 'nonexistent-profile' }
    expectThrowsBeforeWorld(() => simulateCombat(input), /MISSING_DEFINITION/)
  })

  it('preserves all burrow fields from preparedStats into initialState', () => {
    const burrow = { damageReduction: 0.4, regenPercentPerTick: 0.03, emergeAttackMult: 2, emergeAoeRadiusAdd: 24 }
    const input = baseInput()
    input.units[0].preparedStats = { burrowConfig: burrow }
    const result = simulateCombat(input)
    expect(result.initialState[0].burrowConfig).toEqual(burrow)
  })
})

function expectThrowsBeforeWorld(fn: () => void, errorRegex: RegExp): void {
  let rngCalls = 0
  let worldQueueCalls = 0
  const origRng = PRNG.prototype.next
  const origQueue = CombatWorld.prototype.queueUnitCreation
  const origCompiled = CombatWorld.prototype.queueCompiledUnitCreation
  PRNG.prototype.next = function (this: PRNG) { rngCalls++; return origRng.apply(this) }
  CombatWorld.prototype.queueUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueUnitCreation']>) {
    worldQueueCalls++
    return origQueue.apply(this, args)
  }
  CombatWorld.prototype.queueCompiledUnitCreation = function (this: CombatWorld, ...args: Parameters<CombatWorld['queueCompiledUnitCreation']>) {
    worldQueueCalls++
    return origCompiled.apply(this, args)
  }
  try {
    expect(fn).toThrowError(errorRegex)
    expect(rngCalls).toBe(0)
    expect(worldQueueCalls).toBe(0)
  } finally {
    PRNG.prototype.next = origRng
    CombatWorld.prototype.queueUnitCreation = origQueue
    CombatWorld.prototype.queueCompiledUnitCreation = origCompiled
  }
}

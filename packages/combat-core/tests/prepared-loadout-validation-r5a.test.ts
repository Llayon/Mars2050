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

function expectThrowsBeforeWorld(fn: () => void, code: string): void {
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

const periodic = (unitType = 'target', hpPercent?: number) => [{
  id: 'summon',
  intervalTicks: 1,
  initialDelayTicks: 0,
  targetPolicy: 'self' as const,
  payload: { kind: 'spawn' as const, unitType, cap: 1, ...(hpPercent === undefined ? {} : { hpPercent }) },
}]

const trigger = (unitType = 'target') => [{
  id: 'on-death-spawn',
  event: 'death' as const,
  payload: { kind: 'spawn' as const, target: 'self' as const, unitType, count: 1, cap: 1 },
}]

describe('R5a Pass 6: Prepared loadout and support aura input boundary validation', () => {
  it('executes valid prepared periodic ability spawn', () => {
    const input = baseInput()
    input.rules.maxTicks = 3
    input.units[0].preparedStats = { periodicAbilities: periodic() }
    const result = simulateCombat(input)
    const spawns = result.logs.flatMap(tick => tick.actions).filter(a => a.type === 'spawn')
    expect(spawns.length).toBeGreaterThan(0)
  })

  it('rejects prepared periodic with missing spawn definition reference before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = { periodicAbilities: periodic('missing') }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_DEFINITION')
  })

  it('rejects prepared periodic with infinite hpPercent before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = { periodicAbilities: periodic('target', 1e308) }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'INVALID_FIELD_RANGE')
  })

  it('rejects prepared trigger with missing spawn definition reference before world creation', () => {
    const input = baseInput()
    input.units[0].preparedStats = { triggerEffects: trigger('missing') }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_DEFINITION')
  })

  it('accepts valid prepared support aura and propagates to initial state', () => {
    const input = baseInput()
    input.units[0].preparedStats = {
      supportAuras: [{ type: 'regen', radius: 100, value: 1, target: 'allies' }],
    }
    const result = simulateCombat(input)
    expect(result.initialState[0].supportAuras?.[0].type).toBe('regen')
  })

  it('rejects prepared support aura with unknown type before world creation', () => {
    const rawInput = baseInput() as unknown as Record<string, unknown>
    const units = rawInput.units as Array<Record<string, unknown>>
    units[0].preparedStats = {
      supportAuras: [{ type: 'made_up', radius: 100, value: 1, target: 'allies' }],
    }
    expect(battleInputSchema.safeParse(rawInput).success).toBe(false)
    expectThrowsBeforeWorld(() => simulateCombat(rawInput as unknown as BattleInput), 'SCHEMA_VALIDATION_ERROR')
  })

  it('rejects definition prepared XL placement out-of-bounds before world creation', () => {
    const input = baseInput()
    input.definitions.fighter.preparedStats = { size: 'XL' }
    input.units[0].placement.x = 20
    expectThrowsBeforeWorld(() => simulateCombat(input), 'OUT_OF_BOUNDS_COORDINATES')
  })

  it('rejects definition prepared missing summon before world creation', () => {
    const input = baseInput()
    input.definitions.fighter.preparedStats = { periodicAbilities: periodic('missing') }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_DEFINITION')
  })

  it('rejects definition prepared invalid boolean before world creation', () => {
    const input = baseInput() as unknown as Record<string, unknown>
    const defs = input.definitions as Record<string, Record<string, unknown>>
    defs.fighter.preparedStats = { isFlying: 'bad' }
    expect(battleInputSchema.safeParse(input).success).toBe(false)
    expectThrowsBeforeWorld(() => simulateCombat(input as unknown as BattleInput), 'SCHEMA_VALIDATION_ERROR')
  })

  it('applies catalog unitTypes preparedStats without stripping', () => {
    const input = baseInput()
    input.catalog = { unitTypes: { fighter: { ...input.definitions.fighter, preparedStats: { hp: 200 } } } }
    const result = simulateCombat(input)
    expect(result.initialState[0].maxHp).toBe(200)
  })

  it('clamps late-spawned prepared XL units inside arena boundaries', () => {
    const input = baseInput()
    input.arena = { width: 100, height: 100, tileSize: 10, obstacles: [], deployment: { depth: 100 } }
    input.units[0].placement = { x: 10, y: 20, angle: 0 }
    input.units[1].placement = { x: 60, y: 20, angle: Math.PI }
    input.definitions.minion = makeDef('minion', { hp: 100, attack: 0, size: 'S' })
    input.definitions.minion.preparedStats = { hp: 200, size: 'XL' }
    input.definitions.fighter.baseStats.periodicAbilities = periodic('minion')
    const result = simulateCombat(input)
    const minion = result.survivors.find(u => u.type === 'minion')
    expect(minion).toBeDefined()
    expect(minion!.size).toBe('XL')
    expect(minion!.x).toBeGreaterThanOrEqual(45)
    expect(minion!.x).toBeLessThanOrEqual(55)
  })

  it('preserves definition shield when partial instance preparedStats only overrides hp', () => {
    const input = baseInput()
    input.definitions.fighter.preparedStats = { hp: 100, shield: 40 }
    input.units[0].preparedStats = { hp: 200 }
    const result = simulateCombat(input)
    expect(result.initialState[0].maxHp).toBe(200)
    expect(result.initialState[0].maxShield).toBe(40)
  })

  it('catalog definition without preparedStats does not inherit public definition XL', () => {
    const input = baseInput()
    input.definitions.fighter.preparedStats = { size: 'XL' }
    input.catalog = { unitTypes: { fighter: { ...input.definitions.fighter, preparedStats: undefined } } }
    input.units[0].placement.x = 20
    const result = simulateCombat(input)
    expect(result.initialState[0].size).toBe('S')
  })

  it('rejects prepared late-summon conflicting weapons before world creation', () => {
    const input = baseInput()
    input.definitions.fighter.baseStats.periodicAbilities = periodic('minion')
    input.definitions.minion = makeDef('minion', { attack: 0 })
    input.definitions.minion.preparedStats = {
      attackType: 'aoe',
      aoeRadius: 20,
      linePierce: { width: 12, damageMultiplier: 1 },
    }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'SCHEMA_VALIDATION_ERROR')
  })

  it('rejects prepared late spawner with missing reference before world creation', () => {
    const input = baseInput()
    input.definitions.fighter.baseStats.periodicAbilities = periodic('minion')
    input.definitions.minion = makeDef('minion', { attack: 0 })
    input.definitions.minion.preparedStats = {
      spawnerConfig: { unitType: 'missing', interval: 1, timer: 0 },
    }
    expectThrowsBeforeWorld(() => simulateCombat(input), 'MISSING_SPAWN_DEFINITION')
  })
})


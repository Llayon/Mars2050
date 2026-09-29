import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulateCombat, PRNG, type BattleInputSpec, type UnitDefinition } from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}, extra: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id, name: id.toUpperCase(), squadSize: 1, squadSpacing: 20, formation: 'grid',
    baseStats: {
      hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
      actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [], ...overrides,
    },
    ...extra,
  }
}

function baseInput(overrides: Partial<BattleInputSpec> = {}): BattleInputSpec {
  return {
    seed: 42,
    arena: { width: 100, height: 100, tileSize: 20, obstacles: [] },
    rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: { marine: makeDef('marine'), target: makeDef('target') },
    units: [
      { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: {}, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...overrides,
  }
}

function assertZeroLeaks() {
  expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
  expect(CombatWorld.prototype.queueUnitCreation).toHaveBeenCalledTimes(0)
  expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
}

describe('R3b: Arena Bounds & Squad Invariants (ISO-06)', () => {
  beforeEach(() => {
    vi.spyOn(PRNG.prototype, 'next')
    vi.spyOn(CombatWorld.prototype, 'queueUnitCreation')
    vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects squad formation that physically exceeds arena dimensions before RNG or world creation', () => {
    const input = baseInput({
      definitions: {
        giant_squad: makeDef('giant_squad', {}, { squadSize: 16, squadSpacing: 40 }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'squad1', definitionId: 'giant_squad', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
    assertZeroLeaks()
  })

  it('rejects squad formation whose dimensions exceed deployment zone before RNG or world creation', () => {
    const input = baseInput({
      definitions: {
        fat_squad: makeDef('fat_squad', {}, { squadSize: 4, squadSpacing: 30 }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'squad1', definitionId: 'fat_squad', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
    assertZeroLeaks()
  })

  it('rejects explicit unit placement pushing squad members outside arena before RNG or world creation', () => {
    const input = baseInput({
      definitions: {
        squad2: makeDef('squad2', {}, { squadSize: 4, squadSpacing: 20 }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'squad1', definitionId: 'squad2', team: 'attacker', placement: { x: 5, y: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES', path: 'units[0].placement.x' }),
    )
    assertZeroLeaks()
  })

  it('rejects invalid deployment parameters before RNG or world creation', () => {
    const inputInvalidDepth = baseInput({
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { depth: -5 } },
    })
    expect(() => simulateCombat(inputInvalidDepth)).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR' }),
    )
    assertZeroLeaks()

    const inputExcessiveDepth = baseInput({
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { depth: 150 } },
    })
    expect(() => simulateCombat(inputExcessiveDepth)).toThrowError(
      expect.objectContaining({ code: 'INVALID_FIELD_RANGE', path: 'arena.deployment.depth' }),
    )
    assertZeroLeaks()

    const inputInvertedY = baseInput({
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { attacker: { minY: 90, maxY: 80 } } },
    })
    expect(() => simulateCombat(inputInvertedY)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES', path: 'arena.deployment.attacker' }),
    )
    assertZeroLeaks()
  })

  it('rejects partially specified coordinates when squad cannot fit in remaining axis before RNG or world creation', () => {
    const input = baseInput({
      definitions: {
        sq: makeDef('sq', {}, { squadSize: 4, squadSpacing: 80 }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 's', definitionId: 'sq', team: 'attacker', placement: { x: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
    assertZeroLeaks()
  })

  it('rejects unit when body radius extends outside arena even if center is inside before RNG or world creation', () => {
    const input = baseInput({
      definitions: {
        xl: makeDef('xl', { size: 'XL' }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'x', definitionId: 'xl', team: 'attacker', placement: { x: 1, y: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 50, y: 20 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES', path: 'units[0].placement.x' }),
    )
    assertZeroLeaks()
  })

  it('keeps all formation members inside arena and preserves squad size when squad fits', () => {
    const input = baseInput({
      definitions: {
        fitting_squad: makeDef('fitting_squad', {}, { squadSize: 4, squadSpacing: 10 }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'sq', definitionId: 'fitting_squad', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 'tg', definitionId: 'target', team: 'defender', placement: {}, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    expect(result.initialState.length).toBe(5)
    for (const u of result.initialState) {
      expect(u.x).toBeGreaterThanOrEqual(0)
      expect(u.x).toBeLessThanOrEqual(100)
      expect(u.y).toBeGreaterThanOrEqual(0)
      expect(u.y).toBeLessThanOrEqual(100)
    }
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulateCombat, PRNG, type BattleInputSpec, type UnitDefinition } from '../src/index.js'
import { createSpawnBuildSpecs } from '../src/combat.spawn-spec-compiler.js'

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

describe('R3b: Neutral Seeded Placement (ISO-06)', () => {
  beforeEach(() => {
    vi.spyOn(PRNG.prototype, 'next')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places units strictly within bounds on small 100x100 arena when coordinates are omitted', () => {
    const input = baseInput()
    const result = simulateCombat(input)
    expect(result.initialState.length).toBe(2)
    const att = result.initialState.find(u => u.id === 'u1')!
    const def = result.initialState.find(u => u.id === 'u2')!

    expect(att.x).toBeGreaterThanOrEqual(18)
    expect(att.x).toBeLessThanOrEqual(82)
    expect(att.y).toBeGreaterThanOrEqual(75)
    expect(att.y).toBeLessThanOrEqual(82)

    expect(def.x).toBeGreaterThanOrEqual(18)
    expect(def.x).toBeLessThanOrEqual(82)
    expect(def.y).toBeGreaterThanOrEqual(18)
    expect(def.y).toBeLessThanOrEqual(25)
    expect(result.elapsedTicks).toBeGreaterThan(0)
  })

  it('handles partially missing coordinates deterministically with exact RNG call order and counts', () => {
    const defs = { marine: makeDef('marine') }
    const cat = { unitTypes: {}, upgrades: {} }
    const arena = { width: 100, height: 100 }

    // 1. Both coordinates specified: exactly 0 RNG calls
    const rng1 = new PRNG(42)
    const specBoth = { instanceId: 'b', definitionId: 'marine', team: 'attacker' as const, placement: { x: 50, y: 80 }, rank: 1, upgradeIds: [] }
    vi.clearAllMocks()
    const buildsBoth = createSpawnBuildSpecs(specBoth, defs, cat, rng1, arena)
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
    expect(buildsBoth[0].placement.x).toBe(50)
    expect(buildsBoth[0].placement.y).toBe(80)

    // 2. Only X specified: exactly 1 RNG call (for Y)
    const expectedY = Math.floor(new PRNG(42).next() * 7) + 75
    vi.clearAllMocks()
    const rng2 = new PRNG(42)
    const specOnlyX = { instanceId: 'ox', definitionId: 'marine', team: 'attacker' as const, placement: { x: 33 }, rank: 1, upgradeIds: [] }
    const buildsOnlyX = createSpawnBuildSpecs(specOnlyX, defs, cat, rng2, arena)
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(1)
    expect(buildsOnlyX[0].placement.x).toBe(33)
    expect(buildsOnlyX[0].placement.y).toBe(expectedY)

    // 3. Only Y specified: exactly 1 RNG call (for X)
    const expectedX = Math.floor(new PRNG(42).next() * 64) + 18
    vi.clearAllMocks()
    const rng3 = new PRNG(42)
    const specOnlyY = { instanceId: 'oy', definitionId: 'marine', team: 'attacker' as const, placement: { y: 80 }, rank: 1, upgradeIds: [] }
    const buildsOnlyY = createSpawnBuildSpecs(specOnlyY, defs, cat, rng3, arena)
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(1)
    expect(buildsOnlyY[0].placement.x).toBe(expectedX)
    expect(buildsOnlyY[0].placement.y).toBe(80)

    // 4. Neither specified: exactly 2 RNG calls (X first, then Y)
    const expGenRng = new PRNG(42)
    const expX = Math.floor(expGenRng.next() * 64) + 18
    const expY = Math.floor(expGenRng.next() * 7) + 75
    vi.clearAllMocks()
    const rng4 = new PRNG(42)
    const specNone = { instanceId: 'n', definitionId: 'marine', team: 'attacker' as const, placement: {}, rank: 1, upgradeIds: [] }
    const buildsNone = createSpawnBuildSpecs(specNone, defs, cat, rng4, arena)
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(2)
    expect(buildsNone[0].placement.x).toBe(expX)
    expect(buildsNone[0].placement.y).toBe(expY)
  })

  it('preserves legacy Mars coordinates on 600x1200 arena with depth 320 and strategy center', () => {
    const input = baseInput({
      seed: 42,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [], deployment: { depth: 320, strategy: 'center' } },
      definitions: {
        marine: makeDef('marine', { hp: 35, attack: 10, defense: 2, speed: 7, range: 3, size: 'S' }, { squadSize: 8, squadSpacing: 24, formation: 'grid' }),
        target: makeDef('target', { hp: 100, attack: 1, defense: 0, speed: 1, range: 1, size: 'M' }),
      },
      units: [
        { instanceId: 'm', definitionId: 'marine', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
    })
    const r1 = simulateCombat(input)
    const m0 = r1.initialState.find(u => u.id === 'm_0')!
    expect(m0.x).toBe(507)
    expect(m0.y).toBe(1117)
  })

  it('respects single boundary specification in deployment zone', () => {
    const input = baseInput({
      seed: 42,
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { attacker: { maxY: 50 } } },
      units: [
        { instanceId: 'a', definitionId: 'marine', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 50, y: 80 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const att = result.initialState.find(u => u.id === 'a')!
    expect(att.y).toBeLessThanOrEqual(50)
    expect(att.y).toBeGreaterThanOrEqual(0)
  })

  it('respects custom explicit deployment zones on 400x600 arena', () => {
    const input = baseInput({
      arena: {
        width: 400, height: 600, tileSize: 20, obstacles: [],
        deployment: {
          attacker: { minX: 50, maxX: 350, minY: 400, maxY: 550 },
          defender: { minX: 100, maxX: 300, minY: 50, maxY: 200 },
        },
      },
      units: [
        { instanceId: 'a', definitionId: 'marine', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: {}, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const att = result.initialState.find(u => u.id === 'a')!
    const def = result.initialState.find(u => u.id === 'd')!
    expect(att.x).toBeGreaterThanOrEqual(50)
    expect(att.x).toBeLessThanOrEqual(350)
    expect(att.y).toBeGreaterThanOrEqual(400)
    expect(att.y).toBeLessThanOrEqual(550)
    expect(def.x).toBeGreaterThanOrEqual(100)
    expect(def.x).toBeLessThanOrEqual(300)
    expect(def.y).toBeGreaterThanOrEqual(50)
    expect(def.y).toBeLessThanOrEqual(200)
  })

  it('factors body radius into random placement so unseeded units never violate body bounds or fail validator', () => {
    const input = baseInput({ seed: 42 })
    const result = simulateCombat(input)
    const att = result.initialState.find(u => u.id === 'u1')!
    const def = result.initialState.find(u => u.id === 'u2')!
    // M-unit has bodyRadius = 18
    expect(att.x - 18).toBeGreaterThanOrEqual(0)
    expect(att.x + 18).toBeLessThanOrEqual(100)
    expect(att.y - 18).toBeGreaterThanOrEqual(0)
    expect(att.y + 18).toBeLessThanOrEqual(100)

    expect(def.x - 18).toBeGreaterThanOrEqual(0)
    expect(def.x + 18).toBeLessThanOrEqual(100)
    expect(def.y - 18).toBeGreaterThanOrEqual(0)
    expect(def.y + 18).toBeLessThanOrEqual(100)

    // Explicitly passing the generated coordinates passes validation
    const explicitInput = baseInput({
      seed: 42,
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: att.x, y: att.y }, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: def.x, y: def.y }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(explicitInput)).not.toThrow()
  })
})

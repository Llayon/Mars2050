import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulateCombat, PRNG, type BattleInputSpec, type UnitDefinition } from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'
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

function assertZeroLeaks() {
  expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
  expect(CombatWorld.prototype.queueUnitCreation).toHaveBeenCalledTimes(0)
  expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
}

describe('R3b: Center Strategy Bounds & Zero Squad Spacing', () => {
  beforeEach(() => {
    vi.spyOn(PRNG.prototype, 'next')
    vi.spyOn(CombatWorld.prototype, 'queueUnitCreation')
    vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles squadSpacing: 0 correctly without false positive height overflow', () => {
    const input = baseInput({
      seed: 42,
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [] },
      definitions: {
        squad_zero: makeDef('squad_zero', { size: 'S' }, { squadSize: 9, squadSpacing: 0, formation: 'grid' }),
        target: makeDef('target', { size: 'S' }),
      },
      units: [
        { instanceId: 'u1', definitionId: 'squad_zero', team: 'attacker', placement: { x: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    expect(result.initialState.length).toBe(10)
    const squadMembers = result.initialState.filter(u => u.id.startsWith('u1_'))
    expect(squadMembers).toHaveLength(9)
    for (const m of squadMembers) {
      expect(m.x).toBe(50)
      expect(m.y).toBeGreaterThanOrEqual(75)
      expect(m.y).toBeLessThanOrEqual(90)
    }
  })

  it('enforces physical body bounds for single unit under center deployment strategy with partial and omitted coordinates', () => {
    const defs = {
      titan: makeDef('titan', { size: 'XL' }, { squadSize: 1 }),
      target: makeDef('target', { size: 'M' }),
    }
    const cat = { unitTypes: {}, upgrades: {} }
    const arenaSpec = { width: 600, height: 1200, tileSize: 40, obstacles: [], deployment: { depth: 320, strategy: 'center' as const } }

    // 1. Both coordinates omitted: exactly 2 RNG calls, coordinates strictly inside [45, 555] x [880, 1155]
    vi.clearAllMocks()
    const rngNone = new PRNG(5)
    const buildsNone = createSpawnBuildSpecs(
      { instanceId: 't', definitionId: 'titan', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
      defs,
      cat,
      rngNone,
      arenaSpec,
    )
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(2)
    expect(buildsNone).toHaveLength(1)
    const placed = buildsNone[0].placement
    expect(placed.x).toBeGreaterThanOrEqual(45)
    expect(placed.x).toBeLessThanOrEqual(555)
    expect(placed.y).toBeGreaterThanOrEqual(880)
    expect(placed.y).toBeLessThanOrEqual(1155)
    // Physical body with R=45 does NOT exceed arena height 1200
    expect(placed.y! + 45).toBeLessThanOrEqual(1200)

    // 2. Only X specified: exactly 1 RNG call (for Y)
    vi.clearAllMocks()
    const rngOnlyX = new PRNG(5)
    const buildsOnlyX = createSpawnBuildSpecs(
      { instanceId: 't', definitionId: 'titan', team: 'attacker', placement: { x: 300 }, rank: 1, upgradeIds: [] },
      defs,
      cat,
      rngOnlyX,
      arenaSpec,
    )
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(1)
    expect(buildsOnlyX[0].placement.x).toBe(300)
    expect(buildsOnlyX[0].placement.y).toBeGreaterThanOrEqual(880)
    expect(buildsOnlyX[0].placement.y).toBeLessThanOrEqual(1155)

    // 3. Only Y specified: exactly 1 RNG call (for X)
    vi.clearAllMocks()
    const rngOnlyY = new PRNG(5)
    const buildsOnlyY = createSpawnBuildSpecs(
      { instanceId: 't', definitionId: 'titan', team: 'attacker', placement: { y: 1000 }, rank: 1, upgradeIds: [] },
      defs,
      cat,
      rngOnlyY,
      arenaSpec,
    )
    expect(PRNG.prototype.next).toHaveBeenCalledTimes(1)
    expect(buildsOnlyY[0].placement.x).toBeGreaterThanOrEqual(45)
    expect(buildsOnlyY[0].placement.x).toBeLessThanOrEqual(555)
    expect(buildsOnlyY[0].placement.y).toBe(1000)

    // 4. Out-of-bounds explicit Y (1164 where R=45 -> 1209 > 1200) rejected before RNG / world creation
    vi.clearAllMocks()
    const inputExceedY = baseInput({
      arena: arenaSpec,
      definitions: defs,
      units: [
        { instanceId: 't', definitionId: 'titan', team: 'attacker', placement: { x: 246, y: 1164 }, rank: 1, upgradeIds: [] },
        { instanceId: 'tg', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(inputExceedY)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
    assertZeroLeaks()

    // 5. Partially specified out-of-bounds X (580 where R=45 -> 625 > 600, Y omitted) rejected before RNG
    vi.clearAllMocks()
    const inputExceedX = baseInput({
      arena: arenaSpec,
      definitions: defs,
      units: [
        { instanceId: 't', definitionId: 'titan', team: 'attacker', placement: { x: 580 }, rank: 1, upgradeIds: [] },
        { instanceId: 'tg', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => simulateCombat(inputExceedX)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES' }),
    )
    assertZeroLeaks()
  })

  it('determines placement radius from effective definition (catalog ?? definitions) without mixing public size', () => {
    const rawFighterCatalog = makeDef('fighter', { hp: 100 }, { squadSize: 1 })
    const { size: _removedSize, ...baseStatsWithoutSize } = rawFighterCatalog.baseStats
    const fighterCatalogDef = {
      ...rawFighterCatalog,
      baseStats: baseStatsWithoutSize,
    }
    // Explicitly verify size property is genuinely absent in catalog definition
    expect((fighterCatalogDef.baseStats as Record<string, unknown>).size).toBeUndefined()

    const input = baseInput({
      seed: 42,
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { strategy: 'center' } },
      definitions: {
        fighter: makeDef('fighter', { size: 'S' }, { squadSize: 1 }),
        target: makeDef('target', { size: 'M' }),
      },
      catalog: {
        unitTypes: {
          // Catalog definition genuinely lacks size -> defaults to 'M' (radius 18)
          fighter: fighterCatalogDef as unknown as Record<string, unknown>,
          target: makeDef('target', { size: 'M' }) as unknown as Record<string, unknown>,
        },
        upgrades: {},
      },
      units: [
        { instanceId: 'f', definitionId: 'fighter', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 50, y: 20 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const fighter = result.initialState.find(u => u.id === 'f')!
    expect(fighter).toBeDefined()
    // Default size is 'M' (radius 18) -> allowed range on 100x100 is [18, 82]
    expect(fighter.x).toBeGreaterThanOrEqual(18)
    expect(fighter.x).toBeLessThanOrEqual(82)
    expect(fighter.y).toBeGreaterThanOrEqual(18)
    expect(fighter.y).toBeLessThanOrEqual(82)
    // Physical body with R=18 never exceeds arena boundaries (y + 18 <= 100, never 105)
    expect(fighter.y + 18).toBeLessThanOrEqual(100)
  })

  it('places single unit with formation: wedge and non-zero squadSpacing without false height overflow', () => {
    const input = baseInput({
      seed: 42,
      arena: { width: 100, height: 100, tileSize: 20, obstacles: [], deployment: { strategy: 'center' } },
      definitions: {
        single_wedge: makeDef('single_wedge', { size: 'S' }, { squadSize: 1, squadSpacing: 30, formation: 'wedge' }),
        target: makeDef('target', { size: 'S' }),
      },
      units: [
        { instanceId: 'w', definitionId: 'single_wedge', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 50, y: 10 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const wedgeUnit = result.initialState.find(u => u.id === 'w')!
    expect(wedgeUnit).toBeDefined()
    // Single unit with S size (radius 10) must be inside arena boundaries
    expect(wedgeUnit.x - 10).toBeGreaterThanOrEqual(0)
    expect(wedgeUnit.x + 10).toBeLessThanOrEqual(100)
    expect(wedgeUnit.y - 10).toBeGreaterThanOrEqual(0)
    expect(wedgeUnit.y + 10).toBeLessThanOrEqual(100)
    expect(result.elapsedTicks).toBeGreaterThan(0)
  })
})

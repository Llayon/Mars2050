import { describe, it, expect } from 'vitest'
import { simulateCombat, type BattleInputSpec, type UnitDefinition } from '../src/index.js'

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

describe('R3b: Runtime Unit Creation Boundary Clamps', () => {
  it('clamps late summons near the boundary so they never escape the arena', () => {
    const input = baseInput({
      definitions: {
        spawner: makeDef('spawner', { hp: 500, size: 'M' }, {
          periodicAbilities: [{ id: 'sum', intervalTicks: 5, targetPolicy: 'self', payload: { kind: 'spawn', unitType: 'minion' } }],
        } as unknown as Partial<UnitDefinition>),
        minion: makeDef('minion', { hp: 10, size: 'M' }),
        target: makeDef('target', { hp: 1000 }),
      },
      units: [
        { instanceId: 's', definitionId: 'spawner', team: 'attacker', placement: { x: 20, y: 20 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 80, y: 80 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const spawnActions = result.logs
      .flatMap(tick => tick.actions)
      .filter(a => a.type === 'spawn')
    expect(spawnActions.length).toBeGreaterThan(0)
    for (const sa of spawnActions) {
      const x = (sa as Record<string, unknown>).toX as number
      const y = (sa as Record<string, unknown>).toY as number
      expect(x).toBeGreaterThanOrEqual(18)
      expect(x).toBeLessThanOrEqual(82)
      expect(y).toBeGreaterThanOrEqual(18)
      expect(y).toBeLessThanOrEqual(82)
    }
  })

  it('clamps spawn action units near the boundary so XL bodies stay strictly inside arena', () => {
    const input = baseInput({
      definitions: {
        spawner: makeDef('spawner', { hp: 500, size: 'M', attackType: 'spawn', spawnType: 'giant', range: 30, actionCooldownMax: 5 }),
        giant: makeDef('giant', { hp: 100, size: 'XL' }),
        target: makeDef('target', { hp: 1000 }),
      },
      catalog: {
        unitTypes: {
          spawner: makeDef('spawner', { hp: 500, size: 'M', attackType: 'spawn', spawnType: 'giant', range: 30, actionCooldownMax: 5 }) as unknown as Record<string, unknown>,
          giant: makeDef('giant', { hp: 100, size: 'XL' }) as unknown as Record<string, unknown>,
          target: makeDef('target', { hp: 1000 }) as unknown as Record<string, unknown>,
        },
        upgrades: {},
      },
      units: [
        { instanceId: 's', definitionId: 'spawner', team: 'attacker', placement: { x: 20, y: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 20, y: 60 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const spawnActions = result.logs
      .flatMap(tick => tick.actions)
      .filter(a => a.type === 'spawn' && a.unitId === 's')
    expect(spawnActions.length).toBeGreaterThan(0)
    for (const sa of spawnActions) {
      const toX = (sa as Record<string, unknown>).toX as number
      const toY = (sa as Record<string, unknown>).toY as number
      // XL creature bodyRadius = 32
      expect(toX).toBeGreaterThanOrEqual(32)
      expect(toX).toBeLessThanOrEqual(68)
      expect(toY).toBeGreaterThanOrEqual(32)
      expect(toY).toBeLessThanOrEqual(68)
    }
  })

  it('clamps replicateOnKill clones near boundary so XL killer clone stays strictly inside arena', () => {
    const input = baseInput({
      definitions: {
        killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100 }),
        victim: makeDef('victim', { hp: 10, size: 'S' }),
      },
      catalog: {
        unitTypes: {
          killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100 }) as unknown as Record<string, unknown>,
          victim: makeDef('victim', { hp: 10, size: 'S' }) as unknown as Record<string, unknown>,
        },
        upgrades: {
          rep: { id: 'rep', name: 'REP', modifiers: { replicateOnKill: true } },
        },
      },
      units: [
        { instanceId: 'k', definitionId: 'killer', team: 'attacker', placement: { x: 50, y: 50 }, rank: 1, upgradeIds: ['rep'] },
        { instanceId: 'v', definitionId: 'victim', team: 'defender', placement: { x: 10, y: 20 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const cloneSpawn = result.logs
      .flatMap(tick => tick.actions)
      .find(a => a.type === 'spawn' && a.unitId === 'k')
    expect(cloneSpawn).toBeDefined()
    const toX = (cloneSpawn as Record<string, unknown>).toX as number
    const toY = (cloneSpawn as Record<string, unknown>).toY as number
    // XL killer has bodyRadius = 32
    expect(toX).toBeGreaterThanOrEqual(32)
    expect(toY).toBeGreaterThanOrEqual(32)
  })
})

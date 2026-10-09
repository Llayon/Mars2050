import { describe, expect, it } from 'vitest'
import * as combatCore from '../src/index.js'
import { simulateCombat } from '../src/facade/combat-facade.js'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value)
  }
  return obj
}

function makeBasicArena() {
  return {
    width: 600,
    height: 1200,
    tileSize: 40,
    obstacles: [],
    deployment: { strategy: 'center' as const },
  }
}

describe('R5b / ISO-08: Runtime isolation and elimination of global registries', () => {
  it('does not export global registries or mutable singleton setters from combat-core', () => {
    const exports = combatCore as Record<string, unknown>
    expect(exports.registerDefaultCombatCatalog).toBeUndefined()
    expect(exports.getDefaultCombatCatalog).toBeUndefined()
    expect(exports.defaultCombatCatalog).toBeUndefined()
    expect(exports.registerCombatSimulator).toBeUndefined()
    expect(exports.activeSimulator).toBeUndefined()
  })

  it('runs isolated concurrent battles with identical IDs but divergent stats without cross-talk', async () => {
    const arena = makeBasicArena()

    const defA: Record<string, UnitDefinition> = {
      brawler: {
        id: 'brawler',
        name: 'Brawler A',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid',
        baseStats: {
          hp: 120,
          attack: 15,
          defense: 0,
          speed: 60,
          range: 80,
          attackType: 'single',
          actionCooldownMax: 10,
          turnSpeed: 10,
          size: 'M',
          combatTags: [],
        },
      },
    }

    const defB: Record<string, UnitDefinition> = {
      brawler: {
        id: 'brawler',
        name: 'Brawler B (Heavy)',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid',
        baseStats: {
          hp: 600,
          attack: 40,
          defense: 10,
          speed: 60,
          range: 80,
          attackType: 'single',
          actionCooldownMax: 10,
          turnSpeed: 10,
          size: 'M',
          combatTags: [],
        },
      },
    }

    const battleA: BattleInput = deepFreeze({
      seed: 42,
      arena,
      rules: { maxTicks: 25, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defA,
      units: [
        { instanceId: 'a1', definitionId: 'brawler', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 280, y: 300, angle: 0 } },
        { instanceId: 'd1', definitionId: 'brawler', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 320, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defA },
      scheduledEffects: [],
    })

    const battleB: BattleInput = deepFreeze({
      seed: 42,
      arena,
      rules: { maxTicks: 25, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defB,
      units: [
        { instanceId: 'a1', definitionId: 'brawler', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 280, y: 300, angle: 0 } },
        { instanceId: 'd1', definitionId: 'brawler', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 320, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defB },
      scheduledEffects: [],
    })

    const [resA, resB] = await Promise.all([
      simulateCombat(battleA),
      simulateCombat(battleB),
    ])

    expect(resA.initialState[0].maxHp).toBe(120)
    expect(resA.initialState[0].attack).toBe(15)
    expect(resA.initialState[1].maxHp).toBe(120)

    expect(resB.initialState[0].maxHp).toBe(600)
    expect(resB.initialState[0].attack).toBe(40)
    expect(resB.initialState[1].maxHp).toBe(600)

    expect(resA.logs.length).toBeGreaterThan(0)
    expect(resB.logs.length).toBeGreaterThan(0)
    expect(resA.logs).not.toEqual(resB.logs)
  })

  it('resolves late summons and periodic abilities strictly from local catalog without global fallback', async () => {
    const arena = makeBasicArena()

    const defs: Record<string, UnitDefinition> = {
      carrier: {
        id: 'carrier',
        name: 'Spawn Carrier',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid',
        baseStats: {
          hp: 250,
          attack: 0,
          defense: 0,
          speed: 40,
          range: 120,
          attackType: 'spawn',
          spawnType: 'custom_minion',
          spawnCap: 2,
          actionCooldownMax: 5,
          turnSpeed: 5,
          size: 'M',
          combatTags: [],
        },
      },
      custom_minion: {
        id: 'custom_minion',
        name: 'Custom Isolated Minion',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid',
        baseStats: {
          hp: 45,
          attack: 8,
          defense: 1,
          speed: 80,
          range: 40,
          attackType: 'single',
          actionCooldownMax: 8,
          turnSpeed: 10,
          size: 'S',
          combatTags: [],
        },
      },
      target: {
        id: 'target',
        name: 'Target Dummy',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid',
        baseStats: {
          hp: 500,
          attack: 0,
          defense: 0,
          speed: 20,
          range: 40,
          attackType: 'single',
          actionCooldownMax: 100,
          turnSpeed: 5,
          size: 'M',
          combatTags: [],
        },
      },
    }

    const input: BattleInput = deepFreeze({
      seed: 99,
      arena,
      rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defs,
      units: [
        { instanceId: 'c1', definitionId: 'carrier', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 200, y: 300, angle: 0 } },
        { instanceId: 't1', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 260, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defs },
      scheduledEffects: [],
    })

    const res = await simulateCombat(input)
    expect(res.initialState).toHaveLength(2)

    const spawnActions = res.logs.flatMap(tick => tick.actions).filter(entry => entry.type === 'spawn')
    expect(spawnActions.length).toBeGreaterThan(0)
    expect(spawnActions[0]).toMatchObject({
      spawnType: 'custom_minion',
      spawnTeam: 'attacker',
    })
  })
})

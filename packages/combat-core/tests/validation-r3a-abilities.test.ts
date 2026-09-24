import { describe, it, expect } from 'vitest'
import {
  simulateCombat,
  type BattleInputSpec,
  type UnitDefinition,
} from '../src/index.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}, extra: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
    baseStats: {
      hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
      actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
      ...overrides,
    },
    ...extra,
  }
}

function baseInput(overrides: Partial<BattleInputSpec> = {}): BattleInputSpec {
  return {
    seed: 42,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 250, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      marine: makeDef('marine'),
      target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
    },
    units: [
      { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...overrides,
  }
}

describe('R3a Remark 1: Public abilities execution equivalence with catalog', () => {
  const burnAbility = {
    id: 'burn_ability',
    trigger: { kind: 'hit' as const },
    effects: [
      {
        selector: { kind: 'primary_target' as const },
        effects: [{ kind: 'apply_status' as const, status: 'burn' as const, duration: 25, value: 10 }],
      },
    ],
  }

  it('executes public burn ability defined on UnitDefinition and emits status_apply actions', () => {
    const publicInput = baseInput({
      definitions: {
        mage: {
          ...makeDef('mage', { hp: 300, attack: 30, speed: 4, range: 6, combatTags: ['magic'] }),
          abilities: [burnAbility],
        },
        target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'mage_1', definitionId: 'mage', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'target_1', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
    })

    const catalogInput = baseInput({
      definitions: {
        target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'mage_1', definitionId: 'cat_mage', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'target_1', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        unitTypes: {
          cat_mage: {
            name: 'Cat Mage',
            hireCost: {},
            squadSize: 1,
            squadSpacing: 20,
            formation: 'grid',
            baseStats: {
              hp: 300, attack: 30, defense: 5, speed: 4, range: 6, attackType: 'single',
              actionCooldownMax: 10, turnSpeed: 5, size: 'M',
              combatTags: ['magic'],
              abilities: [burnAbility],
            },
          },
        },
      },
    })

    const publicRes = simulateCombat(publicInput)
    const catalogRes = simulateCombat(catalogInput)

    const isBurnApply = (a: { type?: string; statusType?: string }) => a.type === 'status_apply' && a.statusType === 'burn'
    const publicApplies = publicRes.logs.flatMap(t => t.actions).filter(a => isBurnApply(a as { type?: string; statusType?: string }))
    const catalogApplies = catalogRes.logs.flatMap(t => t.actions).filter(a => isBurnApply(a as { type?: string; statusType?: string }))

    expect(publicApplies.length).toBeGreaterThan(0)
    expect(publicApplies.length).toBe(catalogApplies.length)
    expect(publicApplies.length).toBe(25)
  })

  it('negative control: unit without burn ability emits 0 status_apply actions', () => {
    const plainInput = baseInput({
      definitions: {
        mage: makeDef('mage', { hp: 300, attack: 30, speed: 4, range: 6, combatTags: ['magic'] }),
        target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'mage_1', definitionId: 'mage', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'target_1', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
    })
    const res = simulateCombat(plainInput)
    const applies = res.logs.flatMap(t => t.actions).filter(a => (a as { type?: string }).type === 'status_apply')
    expect(applies.length).toBe(0)
  })

  it('executes periodic spawn ability defined on UnitDefinition baseStats and emits spawn actions', () => {
    const periodicSpawn = {
      id: 'spawn_spider',
      intervalTicks: 20,
      payload: { kind: 'spawn' as const, unitType: 'spider', cap: 4 },
    }

    const publicInput = baseInput({
      rules: { maxTicks: 100, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        spawner: makeDef('spawner', {
          hp: 1000, attack: 10, speed: 1, range: 5,
          periodicAbilities: [periodicSpawn],
        }),
        spider: makeDef('spider', { hp: 50, attack: 5, speed: 2, range: 2 }),
        target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'spawner_1', definitionId: 'spawner', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'target_1', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
    })

    const catalogInput = baseInput({
      rules: { maxTicks: 100, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        spider: makeDef('spider', { hp: 50, attack: 5, speed: 2, range: 2 }),
        target: makeDef('target', { hp: 5000, attack: 0, speed: 0 }),
      },
      units: [
        { instanceId: 'spawner_1', definitionId: 'cat_spawner', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'target_1', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        unitTypes: {
          cat_spawner: {
            name: 'Cat Spawner',
            hireCost: {},
            squadSize: 1,
            squadSpacing: 20,
            formation: 'grid',
            baseStats: {
              hp: 1000, attack: 10, defense: 5, speed: 1, range: 5, attackType: 'single',
              actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
              periodicAbilities: [periodicSpawn],
            },
          },
        },
      },
    })

    const publicRes = simulateCombat(publicInput)
    const catalogRes = simulateCombat(catalogInput)

    const isSpawn = (a: { type?: string }) => a.type === 'spawn'
    const publicSpawns = publicRes.logs.flatMap(t => t.actions).filter(a => isSpawn(a as { type?: string }))
    const catalogSpawns = catalogRes.logs.flatMap(t => t.actions).filter(a => isSpawn(a as { type?: string }))

    expect(publicSpawns.length).toBeGreaterThan(0)
    expect(publicSpawns.length).toBe(catalogSpawns.length)
    expect(publicSpawns.length).toBe(4)
  })
})

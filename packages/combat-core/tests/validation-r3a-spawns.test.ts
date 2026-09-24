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
      hp: 100,
      attack: 10,
      defense: 5,
      speed: 3,
      range: 4,
      attackType: 'single',
      actionCooldownMax: 10,
      turnSpeed: 5,
      size: 'M',
      combatTags: [],
      ...overrides,
    },
    ...extra,
  }
}

function baseInput(overrides: Partial<BattleInputSpec> = {}): BattleInputSpec {
  return {
    seed: 42,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 100, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      marine: makeDef('marine'),
      target: makeDef('target'),
    },
    units: [
      { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...overrides,
  }
}

describe('R3a spawn validation remediation', () => {
  it('Remark 1: preserves squadSize = 3 from definitions when catalog has same-named unit without squadSize', () => {
    const input = baseInput({
      definitions: {
        marine: makeDef('marine', {}, { squadSize: 3, squadSpacing: 25, formation: 'line' }),
        target: makeDef('target'),
      },
      catalog: {
        unitTypes: {
          marine: {
            name: 'Marine Catalog Without SquadSize',
            baseStats: {
              hp: 120, attack: 12, defense: 6, speed: 3, range: 4,
              attackType: 'single', actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
            },
            hireCost: {},
          },
        },
      },
    })

    const result = simulateCombat(input)
    const initialUnits = result.initialState
    const marineMembers = initialUnits.filter(u => u.id.startsWith('u1_'))
    expect(marineMembers).toHaveLength(3)
    expect(marineMembers.map(u => u.id).sort()).toEqual(['u1_0', 'u1_1', 'u1_2'])
  })

  it('Remark 2a: rejects missing spawn unit in baseStats.periodicAbilities before simulation', () => {
    const input = baseInput({
      definitions: {
        marine: makeDef('marine', {
          periodicAbilities: [{
            id: 'summon_ghost',
            intervalTicks: 30,
            payload: { kind: 'spawn', unitType: 'ghost', count: 1 },
          }],
        }),
        target: makeDef('target'),
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost',
      }),
    )
  })

  it('Remark 2b: rejects missing spawn unit in upgrades.modifiers.periodicAbilities before simulation', () => {
    const input = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_ghost_summon'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_ghost_summon: {
            id: 'upg_ghost_summon',
            name: 'Ghost Summon Upgrade',
            modifiers: {
              periodicAbilities: [{
                id: 'summon_ghost_upg',
                intervalTicks: 20,
                payload: { kind: 'spawn', unitType: 'ghost', count: 1 },
              }],
            },
          },
        },
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost',
      }),
    )
  })

  it('Remark 2c: rejects missing spawn unit in baseStats.triggerEffects before simulation', () => {
    const input = baseInput({
      definitions: {
        marine: makeDef('marine', {
          triggerEffects: [{
            id: 'on_death_summon_ghost',
            event: 'death',
            payload: { kind: 'spawn', target: 'self', unitType: 'ghost', count: 1 },
          }],
        }),
        target: makeDef('target'),
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost',
      }),
    )
  })

  it('Remark 2d: rejects missing spawn unit in upgrades.modifiers.triggerEffects before simulation', () => {
    const input = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_death_ghost'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_death_ghost: {
            id: 'upg_death_ghost',
            name: 'Death Ghost Upgrade',
            modifiers: {
              triggerEffects: [{
                id: 'on_death_ghost',
                event: 'death',
                payload: { kind: 'spawn', target: 'self', unitType: 'ghost', count: 1 },
              }],
            },
          },
        },
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost',
      }),
    )
  })
})

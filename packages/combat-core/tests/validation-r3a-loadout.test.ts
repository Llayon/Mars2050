import { describe, it, expect, vi } from 'vitest'
import {
  simulateCombat,
  CombatDefinitionError,
  PRNG,
  type BattleInputSpec,
  type UnitDefinition,
} from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'

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

describe('R3a loadout and schema validation remediation', () => {
  it('Remark 3a: rejects catalog unit with empty baseStats before world creation and RNG', () => {
    const nextSpy = vi.spyOn(PRNG.prototype, 'next')
    const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')

    const input = baseInput({
      catalog: {
        unitTypes: {
          empty_unit: {
            name: 'Empty Unit',
            baseStats: {} as unknown as UnitDefinition['baseStats'],
            hireCost: {},
          },
        },
      },
    })

    try {
      simulateCombat(input)
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect((err as CombatDefinitionError).code).toBe('SCHEMA_VALIDATION_ERROR')
    }

    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)
    nextSpy.mockRestore()
    worldSpy.mockRestore()
  })

  it('Remark 3b: rejects catalog unit with invalid attackType magic before simulation', () => {
    const input = baseInput({
      catalog: {
        unitTypes: {
          magic_unit: {
            name: 'Magic Unit',
            baseStats: {
              hp: 100, attack: 10, defense: 5, speed: 3, range: 4,
              attackType: 'magic' as unknown as 'single',
              actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
            },
            hireCost: {},
          },
        },
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
      }),
    )
  })

  it('Remark 3c: rejects malformed abilities [{}] with SCHEMA_VALIDATION_ERROR without unhandled TypeError', () => {
    const input = baseInput({
      definitions: {
        marine: {
          ...makeDef('marine'),
          abilities: [{} as unknown as NonNullable<UnitDefinition['abilities']>[number]],
        },
        target: makeDef('target'),
      },
    })
    expect(() => simulateCombat(input)).toThrowError(
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
      }),
    )
  })

  it('Remark 4a: rejects duplicate periodic ability ID between base unit and upgrade before simulation', () => {
    const nextSpy = vi.spyOn(PRNG.prototype, 'next')
    const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')

    const input = baseInput({
      definitions: {
        marine: makeDef('marine', {
          periodicAbilities: [{
            id: 'heal',
            intervalTicks: 30,
            payload: { kind: 'heal', amount: 15 },
          }],
        }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_heal'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_heal: {
            id: 'upg_heal',
            name: 'Duplicate Heal Upgrade',
            modifiers: {
              periodicAbilities: [{
                id: 'heal',
                intervalTicks: 15,
                payload: { kind: 'heal', amount: 30 },
              }],
            },
          },
        },
      },
    })

    try {
      simulateCombat(input)
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect((err as CombatDefinitionError).code).toBe('SCHEMA_VALIDATION_ERROR')
    }

    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)
    nextSpy.mockRestore()
    worldSpy.mockRestore()
  })

  it('Remark 4b: rejects incompatible geometries (cone + line) combined across base and upgrade before simulation', () => {
    const nextSpy = vi.spyOn(PRNG.prototype, 'next')
    const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')

    const input = baseInput({
      definitions: {
        marine: makeDef('marine', {
          coneAttack: { angle: 0.5, radius: 100, falloff: 0.8 },
        }),
        target: makeDef('target'),
      },
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_line'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_line: {
            id: 'upg_line',
            name: 'Line Pierce Upgrade',
            modifiers: {
              linePierce: { width: 20, maxTargets: 3 },
            },
          },
        },
      },
    })

    try {
      simulateCombat(input)
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect((err as CombatDefinitionError).code).toBe('SCHEMA_VALIDATION_ERROR')
    }

    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)
    nextSpy.mockRestore()
    worldSpy.mockRestore()
  })
})

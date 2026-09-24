import { describe, it, expect, vi } from 'vitest'
import {
  simulateCombat,
  CombatDefinitionError,
  PRNG,
  type BattleInputSpec,
  type UnitDefinition,
} from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
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

describe('R3a Remark 4: Upgrade numeric modifiers validation before simulation', () => {
  it('rejects upgrade with hpMult: "bad" with SCHEMA_VALIDATION_ERROR before world creation and RNG', () => {
    const nextSpy = vi.spyOn(PRNG.prototype, 'next')
    const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')

    const input = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_bad'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_bad: {
            id: 'upg_bad',
            name: 'Broken Upgrade',
            modifiers: {
              hpMult: 'bad' as unknown as number,
            },
          },
        },
      },
    })

    try {
      simulateCombat(input)
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect(err).toBeInstanceOf(CombatDefinitionError)
      const defErr = err as CombatDefinitionError
      expect(defErr.code).toBe('SCHEMA_VALIDATION_ERROR')
      expect(defErr.message).toContain("upgrade 'upg_bad' validation failed")
    }

    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)
    nextSpy.mockRestore()
    worldSpy.mockRestore()
  })

  it('positive control: valid numeric upgrade modifier (hpMult: 1.5) passes and scales unit HP', () => {
    const input = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['upg_hp'] },
        { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
      catalog: {
        upgrades: {
          upg_hp: {
            id: 'upg_hp',
            name: 'HP Boost Upgrade',
            modifiers: {
              hpMult: 1.5,
            },
          },
        },
      },
    })

    const res = simulateCombat(input)
    const marineUnit = res.initialState.find(u => u.id === 'u1')
    expect(marineUnit).toBeDefined()
    expect(marineUnit!.hp).toBe(150)
    expect(marineUnit!.maxHp).toBe(150)
  })
})

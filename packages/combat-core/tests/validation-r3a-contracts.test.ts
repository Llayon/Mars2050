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

describe('R3a Remarks 2, 3, 4: Loadout, squadSize, and upgrade modifiers validation', () => {
  describe('Remark 2: Loadout validation covers all definitions (including late summons)', () => {
    it('rejects late-summon unit with incompatible geometry (cone + line) before world creation and RNG', () => {
      const nextSpy = vi.spyOn(PRNG.prototype, 'next')
      const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')

      const input = baseInput({
        definitions: {
          marine: makeDef('marine'),
          target: makeDef('target'),
          imp: makeDef('imp', {
            coneAttack: { angleDeg: 30, damageMultiplier: 1 },
            linePierce: { width: 20, damageMultiplier: 1 },
          }),
        },
      })

      try {
        simulateCombat(input)
        expect.unreachable('should have thrown CombatDefinitionError')
      } catch (err) {
        expect(err).toBeInstanceOf(CombatDefinitionError)
        const defErr = err as CombatDefinitionError
        expect(defErr.code).toBe('SCHEMA_VALIDATION_ERROR')
        expect(defErr.message).toContain("definition 'imp' weapon loadout error")
      }

      expect(nextSpy).toHaveBeenCalledTimes(0)
      expect(worldSpy).toHaveBeenCalledTimes(0)
      nextSpy.mockRestore()
      worldSpy.mockRestore()
    })

    it('positive control: late-summon unit with compatible geometry (cone only) passes validation and simulates', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine'),
          target: makeDef('target'),
          imp: makeDef('imp', {
            coneAttack: { angleDeg: 30, damageMultiplier: 1 },
          }),
        },
      })
      const result = simulateCombat(input)
      expect(result).toBeDefined()
      expect(result.winner).toBeDefined()
    })
  })

  describe('Remark 3: squadSize validation on catalog definitions', () => {
    it('rejects catalog unit with squadSize: -1 with INVALID_FIELD_RANGE before simulation', () => {
      const input = baseInput({
        definitions: {
          target: makeDef('target'),
        },
        units: [
          { instanceId: 'u1', definitionId: 'cat_negative_squad', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        ],
        catalog: {
          unitTypes: {
            cat_negative_squad: {
              name: 'Bad Squad Unit',
              hireCost: {},
              squadSize: -1,
              baseStats: {
                hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
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
        expect(defErr.code).toBe('INVALID_FIELD_RANGE')
        expect(defErr.message).toContain('squadSize (-1) must be a positive integer')
      }
    })

    it('rejects catalog unit with squadSize: 0 with INVALID_FIELD_RANGE', () => {
      const input = baseInput({
        definitions: {
          target: makeDef('target'),
        },
        units: [
          { instanceId: 'u1', definitionId: 'cat_zero_squad', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        ],
        catalog: {
          unitTypes: {
            cat_zero_squad: {
              name: 'Zero Squad Unit',
              hireCost: {},
              squadSize: 0,
              baseStats: {
                hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
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
        expect(defErr.code).toBe('INVALID_FIELD_RANGE')
        expect(defErr.message).toContain('squadSize (0) must be a positive integer')
      }
    })

    it('positive control: catalog unit with squadSize: 3 creates 3 squad members in initialState', () => {
      const input = baseInput({
        definitions: {
          target: makeDef('target', { hp: 5000 }),
        },
        units: [
          { instanceId: 'squad_att', definitionId: 'cat_squad_3', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
          { instanceId: 'target', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
        catalog: {
          unitTypes: {
            cat_squad_3: {
              name: 'Squad of Three',
              hireCost: {},
              squadSize: 3,
              squadSpacing: 20,
              formation: 'line',
              baseStats: {
                hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
              },
            },
          },
        },
      })

      const res = simulateCombat(input)
      const squadMembers = res.initialState.filter(u => u.id.startsWith('squad_att_'))
      expect(squadMembers.length).toBe(3)
      expect(squadMembers.map(u => u.id)).toEqual(['squad_att_0', 'squad_att_1', 'squad_att_2'])
    })
  })
})


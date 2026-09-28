import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  simulateCombat,
  PRNG,
  type BattleInputSpec,
  type UnitDefinition,
} from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'
import { linePierceAbility } from '../src/combat.ability-config.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}, extra: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
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
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 100, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: { marine: makeDef('marine'), target: makeDef('target') },
    units: [
      { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...overrides,
  }
}

describe('R3a reviewer remarks remediation', () => {
  beforeEach(() => {
    vi.spyOn(PRNG.prototype, 'next')
    vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Remark 1: Normalized definition abilities in upgrade combinations', () => {
    it('rejects definition.abilities with line_pierce combined with coneAttack upgrade before world creation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, { abilities: [linePierceAbility('lp1', { width: 20, damageMultiplier: 1 })] }),
          target: makeDef('target'),
        },
        catalog: {
          upgrades: {
            cone_mod: { name: 'Cone Mod', modifiers: { coneAttack: { angleDeg: 60, damageMultiplier: 1.2 } } },
          },
        },
        units: [
          { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['cone_mod'] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: expect.stringContaining('multiple area geometries (line, cone)'),
        }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('positive control: definition.abilities with line_pierce without conflicting upgrade passes and simulates', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            abilities: [linePierceAbility('lp1', { width: 20, damageMultiplier: 1 })],
          }),
          target: makeDef('target'),
        },
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
    })
  })

  describe('Remark 2: Top-level periodicAbilities spawn references check', () => {
    it('rejects missing spawn definition referenced in top-level periodicAbilities before simulation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'summon_ghost', intervalTicks: 30, targetPolicy: 'self', payload: { kind: 'spawn', unitType: 'ghost', count: 1 } }],
          } as unknown as Partial<UnitDefinition>),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({ code: 'MISSING_SPAWN_DEFINITION', reference: 'ghost' }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('positive control: top-level periodicAbilities with existing spawn definition passes and simulates', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'summon_ghost', intervalTicks: 30, targetPolicy: 'self', payload: { kind: 'spawn', unitType: 'ghost', count: 1 } }],
          } as unknown as Partial<UnitDefinition>),
          ghost: makeDef('ghost'),
          target: makeDef('target'),
        },
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
    })
  })

  describe('Remark 3: Structural validation for periodic ability payload variants', () => {
    it('rejects { kind: "status" } payload missing effects before simulation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'bad_status', intervalTicks: 20, targetPolicy: 'self', payload: { kind: 'status' } } as unknown as UnitDefinition['baseStats']],
          } as unknown as Partial<UnitDefinition>),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR' }))
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('rejects { kind: "damage", amount: "bad" } payload before simulation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'bad_damage', intervalTicks: 20, targetPolicy: 'self', payload: { kind: 'damage', amount: 'bad' } } as unknown as UnitDefinition['baseStats']],
          } as unknown as Partial<UnitDefinition>),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR' }))
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('rejects { kind: "shield", amount: "bad" } payload before simulation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'bad_shield', intervalTicks: 20, targetPolicy: 'self', payload: { kind: 'shield', amount: 'bad' } } as unknown as UnitDefinition['baseStats']],
          } as unknown as Partial<UnitDefinition>),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR' }))
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('positive control: valid periodic status, damage, and shield payloads pass and simulate', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{ id: 'good_shield', intervalTicks: 30, targetPolicy: 'self', payload: { kind: 'shield', amount: 50 } }],
          } as unknown as Partial<UnitDefinition>),
          target: makeDef('target'),
        },
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
    })
  })

  describe('Remark 4: Effective characteristics finiteness validation', () => {
    it('rejects unit whose effective HP becomes Infinity due to hpMult: 1e308 before simulation', () => {
      const input = baseInput({
        catalog: {
          upgrades: {
            astronomical_hp: {
              name: 'Infinite HP',
              modifiers: { hpMult: 1e308 },
            },
          },
        },
        units: [
          { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['astronomical_hp'] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({
          code: 'INVALID_FIELD_RANGE',
          path: 'units[0].effectiveStats.hp',
        }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('positive control: unit with valid hpMult (1.5) scales effective HP and simulates cleanly', () => {
      const input = baseInput({
        catalog: {
          upgrades: {
            reasonable_hp: {
              name: 'Reasonable HP',
              modifiers: { hpMult: 1.5 },
            },
          },
        },
        units: [
          { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['reasonable_hp'] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
      const u1 = result.initialState.find(u => u.id === 'u1')
      expect(u1?.maxHp).toBe(150)
    })
  })
})

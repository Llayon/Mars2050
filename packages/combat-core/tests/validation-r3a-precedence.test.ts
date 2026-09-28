import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  simulateCombat,
  PRNG,
  type BattleInputSpec,
  type UnitDefinition,
} from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'
import { linePierceAbility } from '../src/combat.ability-config.js'
import type { UnitTypeConfig, UnitBaseStats } from '../src/combat.types.js'

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

describe('R3a remediation: definition precedence, frozen catalog, and late summon overflow', () => {
  beforeEach(() => {
    vi.spyOn(PRNG.prototype, 'next')
    vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Problem 1: Combat stats resolution prioritizes catalog.unitTypes over definitions', () => {
    it('rejects catalog line_pierce combined with upgrade coneAttack before RNG and world creation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine'),
          target: makeDef('target'),
        },
        catalog: {
          unitTypes: {
            marine: makeDef('marine', {}, {
              abilities: [linePierceAbility('lp1', { width: 20, damageMultiplier: 1 })],
            }) as unknown as UnitTypeConfig,
          },
          upgrades: { cone_mod: { name: 'Cone Mod', modifiers: { coneAttack: { angleDeg: 60, damageMultiplier: 1.2 } } } },
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

    it('rejects catalog reference to missing summon before RNG and world creation', () => {
      const input = baseInput({
        definitions: { marine: makeDef('marine'), target: makeDef('target') },
        catalog: {
          unitTypes: {
            marine: makeDef('marine', { attackType: 'spawn', spawnType: 'nonexistent_summon' }) as unknown as UnitTypeConfig,
          },
        },
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({ code: 'MISSING_SPAWN_DEFINITION', reference: 'nonexistent_summon' }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('allows valid battle when definitions has line_pierce but catalog overrides with clean stats', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, { abilities: [linePierceAbility('lp1', { width: 20, damageMultiplier: 1 })] }),
          target: makeDef('target'),
        },
        catalog: {
          unitTypes: { marine: makeDef('marine') as unknown as UnitTypeConfig },
          upgrades: { cone_mod: { name: 'Cone Mod', modifiers: { coneAttack: { angleDeg: 60, damageMultiplier: 1.2 } } } },
        },
        units: [
          { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['cone_mod'] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
    })

    it('preserves public definitions squadSize priority when catalog has squadSize: 1', () => {
      const input = baseInput({
        definitions: { marine: makeDef('marine', {}, { squadSize: 3 }), target: makeDef('target') },
        catalog: {
          unitTypes: { marine: makeDef('marine', {}, { squadSize: 1 }) as unknown as UnitTypeConfig },
        },
      })
      const result = simulateCombat(input)
      const marineMembers = result.initialState.filter(u => u.id.startsWith('u1'))
      expect(marineMembers).toHaveLength(3)
    })
  })

  describe('Problem 2: Pure normalization does not mutate or throw on frozen catalog', () => {
    it('accepts Object.freeze(catalog.unitTypes.knight) without mutation or TypeError', () => {
      const frozenKnight = Object.freeze({
        id: 'knight',
        name: 'KNIGHT',
        squadSize: 1,
        baseStats: Object.freeze({
          hp: 200, attack: 15, defense: 8, speed: 2, range: 1, attackType: 'single',
          actionCooldownMax: 12, turnSpeed: 4, size: 'M', combatTags: [],
        }),
      })
      const input = baseInput({
        definitions: { knight: makeDef('knight'), target: makeDef('target') },
        catalog: { unitTypes: { knight: frozenKnight as unknown as UnitTypeConfig } },
        units: [
          { instanceId: 'u1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
          { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
        ],
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
      expect(Object.isFrozen(frozenKnight)).toBe(true)
      expect(Object.isFrozen(frozenKnight.baseStats)).toBe(true)
    })
  })

  describe('Problem 3: Late creation / summon stat overflow check', () => {
    it('rejects periodic summon with hpPercent: 1e308 and base HP 1000 before RNG and world creation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{
              id: 'summon_goblin',
              intervalTicks: 10,
              targetPolicy: 'self',
              payload: { kind: 'spawn', unitType: 'goblin', hpPercent: 1e308 },
            }],
          } as unknown as Partial<UnitDefinition>),
          goblin: makeDef('goblin', { hp: 1000 }),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({
          code: 'INVALID_FIELD_RANGE',
          path: expect.stringContaining('hpPercent'),
        }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })

    it('positive control: periodic summon with hpPercent: 0.5 and base HP 1000 simulates cleanly', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {}, {
            periodicAbilities: [{
              id: 'summon_goblin',
              intervalTicks: 10,
              targetPolicy: 'self',
              payload: { kind: 'spawn', unitType: 'goblin', hpPercent: 0.5 },
            }],
          } as unknown as Partial<UnitDefinition>),
          goblin: makeDef('goblin', { hp: 1000 }),
          target: makeDef('target'),
        },
      })
      const result = simulateCombat(input)
      expect(result.elapsedTicks).toBeGreaterThan(0)
    })

    it('rejects attack spawn with invalid spawnOverrides before RNG and world creation', () => {
      const input = baseInput({
        definitions: {
          marine: makeDef('marine', {
            attackType: 'spawn',
            spawnType: 'target',
            spawnOverrides: { hp: -50 } as unknown as UnitBaseStats['spawnOverrides'],
          }),
          target: makeDef('target'),
        },
      })
      expect(() => simulateCombat(input)).toThrowError(
        expect.objectContaining({
          code: 'INVALID_FIELD_RANGE',
          path: expect.stringContaining('spawnOverrides.hp'),
        }),
      )
      expect(PRNG.prototype.next).toHaveBeenCalledTimes(0)
      expect(CombatWorld.prototype.queueCompiledUnitCreation).toHaveBeenCalledTimes(0)
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import type { PeriodicAbilityConfig } from '../src/combat.sim.types.js'
import { validateBattleInput } from '../src/combat.input-validator.js'
import { simulateCombat } from '../src/facade/combat-facade.js'

function def(id: string, over: Partial<UnitDefinition['baseStats']> = {}, squadOver: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id,
    name: id,
    baseStats: {
      hp: 100, attack: 10, defense: 2, speed: 4, range: 2,
      attackType: 'single', actionCooldownMax: 10, turnSpeed: 5,
      size: 'M', combatTags: [], ...over,
    },
    squadSize: 1, squadSpacing: 20, formation: 'grid',
    ...squadOver,
  }
}

function baseInput(over: Partial<BattleInput> = {}): BattleInput {
  const knight = def('knight')
  return {
    seed: 42,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 300, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: { knight },
    units: [
      { instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'k2', definitionId: 'knight', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...over,
  }
}

describe('R3a catalog and upgrade validation', () => {
  it('rejects catalog unit overriding definition with invalid duration 0 in statusOnHit', () => {
    const input = baseInput({
      catalog: {
        unitTypes: {
          knight: {
            name: 'Knight Override',
            baseStats: {
              hp: 100, attack: 10, defense: 2, speed: 4, range: 2,
              attackType: 'single', actionCooldownMax: 10,
              statusOnHit: [{ type: 'burn', duration: 0 }],
            },
            hireCost: {},
          },
        },
      },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'INVALID_FIELD_RANGE',
        path: 'definitions.knight.baseStats.statusOnHit[0].duration',
      }),
    )
  })

  it('rejects catalog unit overriding definition with unknown targetingProfile', () => {
    const input = baseInput({
      catalog: {
        unitTypes: {
          knight: {
            name: 'Knight Override',
            baseStats: {
              hp: 100, attack: 10, defense: 2, speed: 4, range: 2,
              attackType: 'single', actionCooldownMax: 10,
              targetingProfile: 'non_existent_profile',
            },
            hireCost: {},
          },
        },
      },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_DEFINITION',
        reference: 'non_existent_profile',
      }),
    )
  })

  it('rejects catalog unit missing baseStats with MISSING_DEFINITION', () => {
    const input = baseInput({
      catalog: {
        unitTypes: {
          broken_unit: {
            name: 'Broken Unit',
            hireCost: {},
          } as unknown as Record<string, unknown>,
        },
      },
      units: [
        { instanceId: 'b1', definitionId: 'broken_unit', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_DEFINITION',
        definitionId: 'broken_unit',
        path: 'definitions.broken_unit.baseStats',
      }),
    )
  })

  it('rejects upgrade with periodicSpawn pointing to unknown definition with MISSING_SPAWN_DEFINITION', () => {
    const input = baseInput({
      catalog: {
        upgrades: {
          ghost_spawner_upgrade: {
            id: 'ghost_spawner_upgrade',
            name: 'Ghost Spawner',
            modifiers: { periodicSpawn: { unit: 'ghost_non_existent_unit', interval: 5 } },
          },
        },
      },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost_non_existent_unit',
      }),
    )
  })

  it('rejects upgrade with onDeathSpawn pointing to unknown definition with MISSING_SPAWN_DEFINITION', () => {
    const input = baseInput({
      catalog: {
        upgrades: {
          ghost_death_upgrade: {
            id: 'ghost_death_upgrade',
            name: 'Ghost Death',
            modifiers: { onDeathSpawn: 'ghost_non_existent_wraith' },
          },
        },
      },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        reference: 'ghost_non_existent_wraith',
      }),
    )
  })

  it('rejects definition with invalid periodic ability (interval <= 0) with SCHEMA_VALIDATION_ERROR', () => {
    const badKnight = def('bad_knight')
    const badKnightCatalog = {
      ...badKnight,
      baseStats: {
        ...badKnight.baseStats,
        periodicAbilities: [
          { id: 'bad_p', intervalTicks: 0 } as unknown as PeriodicAbilityConfig,
        ],
      },
    }
    const input = baseInput({
      catalog: {
        unitTypes: { bad_knight: badKnightCatalog },
      },
      definitions: { knight: def('knight') },
      units: [
        { instanceId: 'b1', definitionId: 'bad_knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'k2', definitionId: 'knight', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'SCHEMA_VALIDATION_ERROR',
      }),
    )
  })

  it('passes public targetingProfile through mapper and prefers preferred tag in targeting', () => {
    const siegeAttacker = def('catapult', { range: 200, targetingProfile: 'siege' })
    const defenderTroop = def('infantry', { hp: 1000 })
    const defenderTower = def('tower', { hp: 1000, combatTags: ['structure'] })

    const input = baseInput({
      rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { catapult: siegeAttacker, infantry: defenderTroop, tower: defenderTower },
      units: [
        { instanceId: 'att_siege', definitionId: 'catapult', team: 'attacker', placement: { x: 300, y: 600 }, rank: 1, upgradeIds: [] },
        { instanceId: 'def_normal', definitionId: 'infantry', team: 'defender', placement: { x: 300, y: 550 }, rank: 1, upgradeIds: [] },
        { instanceId: 'def_structure', definitionId: 'tower', team: 'defender', placement: { x: 300, y: 500 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).not.toThrow()
    const result = simulateCombat(input)
    expect(result.initialState.some(u => u.id === 'att_siege')).toBe(true)
    const attackActions = result.logs.flatMap(t => t.actions).filter(
      a => (a.sourceId === 'att_siege' || (a as { unitId?: string }).unitId === 'att_siege') && a.type === 'attack',
    )
    expect(attackActions.length).toBeGreaterThan(0)
    expect(attackActions[0]?.targetId).toBe('def_structure')
  })
})

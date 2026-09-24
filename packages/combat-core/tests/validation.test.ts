import { describe, expect, it, vi } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import { CombatDefinitionError } from '../src/combat.definition-error.js'
import { validateBattleInput } from '../src/combat.input-validator.js'
import { simulateCombat } from '../src/facade/combat-facade.js'
import { PRNG } from '../src/math/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'

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

describe('R3a pre-simulation input validation', () => {
  it('accepts a fully valid battle input', () => {
    const input = baseInput()
    const validated = validateBattleInput(input)
    expect(validated.seed).toBe(42)
    expect(validated.units).toHaveLength(2)
  })

  it('rejects schema-invalid input with SCHEMA_VALIDATION_ERROR and field path', () => {
    expect(() => validateBattleInput({ ...baseInput(), seed: 'not-a-number' as unknown as number })).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VALIDATION_ERROR', path: 'seed' }),
    )
  })

  it('rejects definition key mismatch with INVALID_DEFINITION_KEY', () => {
    const badDef = def('actual_id')
    expect(() => validateBattleInput(baseInput({ definitions: { mismatched_key: badDef } }))).toThrowError(
      expect.objectContaining({ code: 'INVALID_DEFINITION_KEY', path: 'definitions.mismatched_key.id', reference: 'actual_id' }),
    )
  })

  it('rejects unsupported attack types with UNSUPPORTED_ATTACK_TYPE', () => {
    const beamUnit = def('beam_unit', { attackType: 'beam' as unknown as 'single' })
    expect(() => validateBattleInput(baseInput({ definitions: { beam_unit: beamUnit } }))).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_ATTACK_TYPE', definitionId: 'beam_unit', attackType: 'beam' }),
    )
  })

  it('rejects spawn attackType without spawnType with MISSING_SPAWN_TYPE', () => {
    const badSpawner = def('bad_spawner', { attackType: 'spawn', spawnType: undefined })
    expect(() => validateBattleInput(baseInput({ definitions: { bad_spawner: badSpawner } }))).toThrowError(
      expect.objectContaining({ code: 'MISSING_SPAWN_TYPE', definitionId: 'bad_spawner', path: 'definitions.bad_spawner.baseStats.spawnType' }),
    )
  })

  it('rejects placement coordinates outside arena bounds with OUT_OF_BOUNDS_COORDINATES', () => {
    const input = baseInput({ units: [{ instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 750, y: 1000 }, rank: 1, upgradeIds: [] }] })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES', path: 'units[0].placement.x', reference: '750' }),
    )
  })

  it('rejects obstacle coordinates outside arena bounds with OUT_OF_BOUNDS_COORDINATES', () => {
    const input = baseInput({ arena: { width: 600, height: 1200, tileSize: 40, obstacles: [{ x: 300, y: 1500, radius: 20 }] } })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({ code: 'OUT_OF_BOUNDS_COORDINATES', path: 'arena.obstacles[0]' }),
    )
  })

  it('rejects currentHp exceeding maxHp with INVALID_FIELD_RANGE', () => {
    const input = baseInput({ units: [{ instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [], currentHp: 500 }] })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({ code: 'INVALID_FIELD_RANGE', path: 'units[0].currentHp', reference: '500' }),
    )
  })

  it('allows scheduledEffect tick exceeding rules.maxTicks without error (will not trigger)', () => {
    const input = baseInput({
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      scheduledEffects: [{ id: 'strike', tick: 500, team: 'attacker', type: 'orbital_strike', value: 100 }],
    })
    expect(() => validateBattleInput(input)).not.toThrow()
  })

  it('rejects unsupported scheduled effect type with UNSUPPORTED_SCHEDULED_EFFECT', () => {
    const input = baseInput({ scheduledEffects: [{ id: 'bad_eff', tick: 50, team: 'attacker', type: 'supernova', value: 100 }] })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_SCHEDULED_EFFECT', effectId: 'bad_eff', effectType: 'supernova' }),
    )
  })

  it('rejects invalid scheduled effect values with INVALID_FIELD_RANGE', () => {
    expect(() => validateBattleInput(baseInput({
      scheduledEffects: [{ id: 'mh', tick: 10, team: 'attacker', type: 'mass_heal', value: -20 }],
    }))).toThrowError(expect.objectContaining({ code: 'INVALID_FIELD_RANGE', path: 'scheduledEffects[0].value' }))

    expect(() => validateBattleInput(baseInput({
      scheduledEffects: [{ id: 'emp', tick: 10, team: 'attacker', type: 'global_emp', value: 3.5 }],
    }))).toThrowError(expect.objectContaining({ code: 'INVALID_FIELD_RANGE', path: 'scheduledEffects[0].value' }))
  })

  it('allows currentHp elevated by rank/upgrades up to effective maxHp, rejecting above', () => {
    const catalog = {
      upgrades: {
        heavy_armor: {
          id: 'heavy_armor',
          name: 'Heavy Armor',
          modifiers: { hpMult: 1.15 },
        },
      },
    }
    const validElevated = baseInput({
      catalog: catalog as unknown as BattleInput['catalog'],
      units: [
        { instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['heavy_armor'], currentHp: 115 },
      ],
    })
    expect(() => validateBattleInput(validElevated)).not.toThrow()

    const excessHp = baseInput({
      catalog: catalog as unknown as BattleInput['catalog'],
      units: [
        { instanceId: 'k1', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: ['heavy_armor'], currentHp: 116 },
      ],
    })
    expect(() => validateBattleInput(excessHp)).toThrowError(
      expect.objectContaining({ code: 'INVALID_FIELD_RANGE', reference: '116' }),
    )
  })

  it('formats UNSUPPORTED_SCHEDULED_EFFECT correctly with legacy empty string arguments', () => {
    const err = new CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT', '', '', {
      effectId: 'orbit_1',
      effectType: 'bad_laser',
    })
    expect(err.message).toBe("[UNSUPPORTED_SCHEDULED_EFFECT] scheduled effect 'orbit_1' uses unsupported type 'bad_laser'")
    expect(err.effectId).toBe('orbit_1')
    expect(err.effectType).toBe('bad_laser')
  })

  it('guarantees identical error codes and details for JSON-stringified input', () => {
    const raw = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'ghost_unit', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      ],
    })
    const jsonParsed = JSON.parse(JSON.stringify(raw)) as BattleInput

    let rawError: CombatDefinitionError | undefined
    let jsonError: CombatDefinitionError | undefined

    try {
      simulateCombat(raw)
    } catch (err) {
      rawError = err as CombatDefinitionError
    }

    try {
      simulateCombat(jsonParsed)
    } catch (err) {
      jsonError = err as CombatDefinitionError
    }

    expect(rawError).toBeDefined()
    expect(jsonError).toBeDefined()
    expect(rawError?.code).toBe('MISSING_DEFINITION')
    expect(jsonError?.code).toBe('MISSING_DEFINITION')
    expect(rawError?.path).toBe(jsonError?.path)
    expect(rawError?.reference).toBe(jsonError?.reference)
  })

  it('guarantees zero PRNG consumption and zero world creation when input validation fails', () => {
    const nextSpy = vi.spyOn(PRNG.prototype, 'next')
    const worldSpy = vi.spyOn(CombatWorld.prototype, 'queueUnitCreation')

    try {
      simulateCombat({
        ...baseInput(),
        units: [
          { instanceId: 'bad_unit', definitionId: 'unknown_def', team: 'attacker', placement: { x: 100, y: 100 }, rank: 1, upgradeIds: [] },
        ],
      })
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect((err as CombatDefinitionError).code).toBe('MISSING_DEFINITION')
    }
    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)

    const badStatusDef = def('bad_status', {
      statusOnHit: [{ type: 'burn', duration: 0, value: 5 } as unknown as { type: 'burn'; duration: number; value?: number }],
    })
    try {
      simulateCombat(baseInput({ definitions: { bad_status: badStatusDef, knight: def('knight') } }))
      expect.unreachable('should have thrown CombatDefinitionError')
    } catch (err) {
      expect(['SCHEMA_VALIDATION_ERROR', 'INVALID_FIELD_RANGE']).toContain((err as CombatDefinitionError).code)
    }
    expect(nextSpy).toHaveBeenCalledTimes(0)
    expect(worldSpy).toHaveBeenCalledTimes(0)

    nextSpy.mockRestore()
    worldSpy.mockRestore()
  })
})

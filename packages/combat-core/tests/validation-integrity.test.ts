import { describe, expect, it } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import { validateBattleInput } from '../src/combat.input-validator.js'

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

describe('R3a referential integrity validation', () => {
  it('rejects missing definition reference in units with MISSING_DEFINITION', () => {
    const input = baseInput({
      units: [
        { instanceId: 'u1', definitionId: 'non_existent', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_DEFINITION',
        reference: 'non_existent',
        path: 'units[0].definitionId',
      }),
    )
  })

  it('rejects duplicate unit instanceId with DUPLICATE_INSTANCE_ID', () => {
    const input = baseInput({
      units: [
        { instanceId: 'same_id', definitionId: 'knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'same_id', definitionId: 'knight', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'DUPLICATE_INSTANCE_ID',
        reference: 'same_id',
        path: 'units[1].instanceId',
      }),
    )
  })

  it('rejects squad member ID collision with DUPLICATE_SQUAD_MEMBER_ID', () => {
    const squadDef = def('squad_knight', {}, { squadSize: 2 })
    const input = baseInput({
      definitions: { squad_knight: squadDef, knight: def('knight') },
      units: [
        { instanceId: 'squad1', definitionId: 'squad_knight', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
        { instanceId: 'squad1_0', definitionId: 'knight', team: 'attacker', placement: { x: 350, y: 1000 }, rank: 1, upgradeIds: [] },
      ],
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'DUPLICATE_SQUAD_MEMBER_ID',
        reference: 'squad1_0',
      }),
    )
  })

  it('rejects unknown spawnType definition with MISSING_SPAWN_DEFINITION', () => {
    const summoner = def('summoner', { attackType: 'spawn', spawnType: 'unknown_ghost', spawnCap: 2 })
    const input = baseInput({
      definitions: { summoner, knight: def('knight') },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'MISSING_SPAWN_DEFINITION',
        definitionId: 'summoner',
        reference: 'unknown_ghost',
        path: 'definitions.summoner.baseStats.spawnType',
      }),
    )
  })

  it('rejects unconstrained summon cycle lacking spawnCap with UNCONSTRAINED_SUMMON_CYCLE', () => {
    const hydra = def('hydra', { attackType: 'spawn', spawnType: 'hydra' })
    const input = baseInput({
      definitions: { hydra, knight: def('knight') },
    })
    expect(() => validateBattleInput(input)).toThrowError(
      expect.objectContaining({
        code: 'UNCONSTRAINED_SUMMON_CYCLE',
        definitionId: 'hydra',
      }),
    )
  })

  it('allows constrained summon cycle when spawnCap is defined', () => {
    const cappedHydra = def('capped_hydra', { attackType: 'spawn', spawnType: 'capped_hydra', spawnCap: 2 })
    const input = baseInput({
      definitions: { capped_hydra: cappedHydra, knight: def('knight') },
    })
    expect(() => validateBattleInput(input)).not.toThrow()
  })
})

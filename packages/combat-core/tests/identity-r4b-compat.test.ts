import { describe, expect, it } from 'vitest'
import {
  simulateCombat,
  type BattleInput,
  type UnitDefinition,
  type CombatMetadata,
  checkIdentityCompatibility,
  combatMetadataSchema,
} from '../src/index.js'

function makeBaseInput(): BattleInput {
  const definitions: Record<string, UnitDefinition> = {
    soldier: {
      id: 'soldier',
      name: 'Soldier',
      baseStats: {
        hp: 100, maxHp: 100, attack: 10, defense: 2, speed: 15, range: 40,
        actionCooldownMax: 10, actionCooldown: 0, canTargetAir: false, size: 'M',
        attackType: 'single', aggroLockTicks: 5, turnSpeed: 10, combatTags: [],
      },
      squadSize: 1,
      squadSpacing: 20,
      formation: 'grid',
    },
  }
  return {
    seed: 12345,
    arena: { width: 300, height: 300, tileSize: 20, obstacles: [] },
    rules: { maxTicks: 100, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions,
    units: [
      { instanceId: 'u1', team: 'attacker', definitionId: 'soldier', placement: { x: 50, y: 150 }, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', team: 'defender', definitionId: 'soldier', placement: { x: 250, y: 150 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }
}

describe('R4b: Compatibility and schema validation checks', () => {
  it('reports incompatibility when engine revision or defense mode mismatches', () => {
    const input = makeBaseInput()
    const result = simulateCombat(input)
    const meta = result.metadata as CombatMetadata

    const ok = checkIdentityCompatibility(meta, {
      revision: meta.engine.revision,
      defenseResolutionMode: meta.engine.defenseResolutionMode,
    })
    expect(ok.compatible).toBe(true)
    expect(ok.reasons).toHaveLength(0)

    const revMismatch = checkIdentityCompatibility(meta, {
      revision: 'other-build-revision',
      defenseResolutionMode: meta.engine.defenseResolutionMode,
    })
    expect(revMismatch.compatible).toBe(false)
    expect(revMismatch.reasons[0]).toContain('Engine revision mismatch')

    const modeMismatch = checkIdentityCompatibility(meta, {
      revision: meta.engine.revision,
      defenseResolutionMode: 'v8_sequential',
    })
    expect(modeMismatch.compatible).toBe(false)
    expect(modeMismatch.reasons[0]).toContain('Defense resolution mode mismatch')
  })

  it('rejects incompatible contractVersion, replaySchema, engineId, and engineVersion', () => {
    const input = makeBaseInput()
    const result = simulateCombat(input)
    const meta = result.metadata as CombatMetadata
    const target = { revision: meta.engine.revision, defenseResolutionMode: meta.engine.defenseResolutionMode }

    // Contract version mismatch
    const contractMismatch = checkIdentityCompatibility({ ...meta, contractVersion: '999.0.0' }, target)
    expect(contractMismatch.compatible).toBe(false)
    expect(contractMismatch.reasons[0]).toContain('Contract version incompatible')

    // Replay schema version mismatch
    const schemaMismatch = checkIdentityCompatibility({ ...meta, replaySchema: { ...meta.replaySchema, version: '999.0.0' } }, target)
    expect(schemaMismatch.compatible).toBe(false)
    expect(schemaMismatch.reasons[0]).toContain('Replay schema version incompatible')

    // Engine ID mismatch
    const engineIdMismatch = checkIdentityCompatibility({ ...meta, engine: { ...meta.engine, id: '@different/engine' } }, target)
    expect(engineIdMismatch.compatible).toBe(false)
    expect(engineIdMismatch.reasons[0]).toContain('Engine id mismatch')

    // Engine version mismatch
    const engineVerMismatch = checkIdentityCompatibility({ ...meta, engine: { ...meta.engine, version: '999.0.0' } }, target)
    expect(engineVerMismatch.compatible).toBe(false)
    expect(engineVerMismatch.reasons[0]).toContain('Engine version incompatible')
  })

  it('combatMetadataSchema validates SHA-256 format for contentHash strictly', () => {
    const input = makeBaseInput()
    const result = simulateCombat(input)
    const validMeta = result.metadata as CombatMetadata
    expect(combatMetadataSchema.safeParse(validMeta).success).toBe(true)

    const invalidMeta = { ...validMeta, ruleset: { ...validMeta.ruleset, contentHash: 'not-a-sha256' } }
    expect(combatMetadataSchema.safeParse(invalidMeta).success).toBe(false)
  })
})

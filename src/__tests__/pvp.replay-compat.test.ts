import { describe, expect, it } from 'vitest'
import legacyV2Fixture from './fixtures/combat-replay-v2.json'
import { buildReplayRenderUnits } from '@/components/game/battle-replay-state'
import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import { getReplayCompatibility, parseBattleReplayResponse } from '@/domains/pvp/pvp.replay-compat'

describe('stored battle replay compatibility', () => {
  it('loads a v2 snapshot as a visually approximate replay', () => {
    const replay = parseBattleReplayResponse(legacyV2Fixture)

    expect(replay?.compatibility).toMatchObject({
      status: 'legacy_approximate',
      canPlay: true,
      visuallyApproximate: true,
      reason: 'older_engine',
    })
    expect(replay?.terminationReason).toBe('elimination')
    expect(replay?.elapsedTicks).toBe(1)

    const renderUnits = buildReplayRenderUnits([], [], replay?.logs ?? [], replay?.initialState)
    expect(renderUnits.map(unit => unit.unit.id)).toEqual(['marine_0'])
  })

  it('classifies a v3 snapshot as a visually approximate replay', () => {
    expect(getReplayCompatibility(3)).toMatchObject({
      snapshotVersion: 3,
      currentVersion: CURRENT_SIMULATION_VERSION,
      status: 'legacy_approximate',
      canPlay: true,
      visuallyApproximate: true,
      reason: 'older_engine',
    })
  })

  it('classifies the current replay version without approximation', () => {
    expect(getReplayCompatibility(CURRENT_SIMULATION_VERSION, CURRENT_SIMULATION_REVISION)).toEqual({
      snapshotVersion: CURRENT_SIMULATION_VERSION,
      currentVersion: CURRENT_SIMULATION_VERSION,
      status: 'current',
      canPlay: true,
      visuallyApproximate: false,
    })
  })

  it('rejects a stored V8 replay without the stabilized engine revision', () => {
    expect(getReplayCompatibility(CURRENT_SIMULATION_VERSION)).toMatchObject({
      status: 'unsupported',
      canPlay: false,
      reason: 'engine_revision_mismatch',
    })
  })

  it('returns an explicit unsupported result for a newer engine version', () => {
    const futureFixture = structuredClone(legacyV2Fixture)
    futureFixture.snapshot.version = CURRENT_SIMULATION_VERSION + 1

    const replay = parseBattleReplayResponse(futureFixture)
    expect(replay?.compatibility).toMatchObject({
      status: 'unsupported',
      canPlay: false,
      reason: 'newer_engine',
    })
    expect(replay?.initialState).toEqual([])
    expect(replay?.logs).toEqual([])
  })

  it('rejects a malformed payload for an otherwise playable version', () => {
    const malformedFixture = structuredClone(legacyV2Fixture)
    malformedFixture.snapshot.initial_state = { units: [] } as unknown as typeof malformedFixture.snapshot.initial_state

    expect(parseBattleReplayResponse(malformedFixture)).toBeNull()
  })

  function makeEnvelope(metadata?: unknown) {
    const env = structuredClone(legacyV2Fixture) as Record<string, unknown>
    const snapshot = env.snapshot as Record<string, unknown>
    snapshot.version = CURRENT_SIMULATION_VERSION
    snapshot.metrics = { engineRevision: CURRENT_SIMULATION_REVISION, ...(metadata !== undefined ? { metadata } : {}) }
    if (metadata !== undefined) snapshot.metadata = metadata
    return env
  }

  it('preserves valid metadata and marks status as current for valid envelope', () => {
    const validMeta = {
      contractVersion: '1.0.0',
      engine: {
        id: '@mars2050/combat-core',
        version: '0.1.0',
        revision: CURRENT_SIMULATION_REVISION,
        buildId: 'combat-core-r4b-20261006',
        defenseResolutionMode: 'v9_snapshot' as const,
      },
      ruleset: {
        id: 'standard',
        version: '1.0.0',
        contentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      replaySchema: { id: 'combat-replay', version: '1.0.0' },
    }
    const env = makeEnvelope(validMeta)
    const replay = parseBattleReplayResponse(env)
    expect(replay?.metadata).toEqual(validMeta)
    expect(replay?.compatibility).toMatchObject({
      status: 'current',
      canPlay: true,
      visuallyApproximate: false,
    })
  })

  it('rejects envelopes with incompatible identity fields', () => {
    const baseMeta = {
      contractVersion: '1.0.0',
      engine: {
        id: '@mars2050/combat-core',
        version: '0.1.0',
        revision: CURRENT_SIMULATION_REVISION,
        buildId: 'combat-core-r4b-20261006',
        defenseResolutionMode: 'v9_snapshot' as const,
      },
      ruleset: {
        id: 'standard',
        version: '1.0.0',
        contentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      replaySchema: { id: 'combat-replay', version: '1.0.0' },
    }

    const testCases = [
      { field: 'contractVersion', meta: { ...baseMeta, contractVersion: '999.0.0' } },
      { field: 'replaySchema', meta: { ...baseMeta, replaySchema: { id: 'combat-replay', version: '999.0.0' } } },
      { field: 'engineId', meta: { ...baseMeta, engine: { ...baseMeta.engine, id: '@different/engine' } } },
      { field: 'engineVersion', meta: { ...baseMeta, engine: { ...baseMeta.engine, version: '999.0.0' } } },
    ]

    for (const { field, meta } of testCases) {
      const env = makeEnvelope(meta)
      const replay = parseBattleReplayResponse(env)
      expect(replay?.compatibility.canPlay, `failed on ${field}`).toBe(false)
      expect(replay?.compatibility.status).toBe('unsupported')
      expect(replay?.metadata).toEqual(meta)
    }
  })

  it('rejects malformed metadata envelopes with explicit malformed_metadata status', () => {
    const malformedMetaList: unknown[] = [
      { engine: 'bad', contractVersion: 42 },
      { contractVersion: '1.0.0', ruleset: { contentHash: 'not-sha' } },
      { contractVersion: '1.0.0' },
    ]

    for (const badMeta of malformedMetaList) {
      const env = makeEnvelope(badMeta)
      const replay = parseBattleReplayResponse(env)
      expect(replay?.compatibility).toMatchObject({
        status: 'unsupported',
        canPlay: false,
        reason: 'malformed_metadata',
      })
      expect(replay?.initialState).toEqual([])
      expect(replay?.logs).toEqual([])
    }
  })

  it('preserves genuine V8 replay playback with V8 metadata and rejects version contradictions', () => {
    const v8Meta = {
      contractVersion: '1.0.0',
      engine: {
        id: '@mars2050/combat-core',
        version: '0.1.0',
        revision: 'combat-ecs-v8-deterministic-trig-r4',
        buildId: 'combat-core-r4b-20261006',
        defenseResolutionMode: 'v8_sequential' as const,
      },
      ruleset: {
        id: 'standard',
        version: '1.0.0',
        contentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      replaySchema: { id: 'combat-replay', version: '1.0.0' },
    }
    const envV8 = makeEnvelope(v8Meta)
    const snapV8 = envV8.snapshot as Record<string, unknown>
    snapV8.version = 8
    ;(snapV8.metrics as Record<string, unknown>).engineRevision = 'combat-ecs-v8-deterministic-trig-r4'

    const replayV8 = parseBattleReplayResponse(envV8)
    expect(replayV8?.compatibility).toMatchObject({
      status: 'legacy_approximate',
      canPlay: true,
      visuallyApproximate: true,
      reason: 'older_engine',
    })

    const v9Meta = { ...v8Meta, engine: { ...v8Meta.engine, defenseResolutionMode: 'v9_snapshot' as const } }
    const envContradict = makeEnvelope(v9Meta)
    const snapC = envContradict.snapshot as Record<string, unknown>
    snapC.version = 8
    const replayC = parseBattleReplayResponse(envContradict)
    expect(replayC?.compatibility.canPlay).toBe(false)
    expect(replayC?.compatibility.status).toBe('unsupported')
  })
})

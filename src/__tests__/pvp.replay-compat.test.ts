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
})

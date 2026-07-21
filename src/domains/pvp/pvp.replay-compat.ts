import { CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleTick, SimUnit } from '@/domains/combat/combat.types'
import type { ReplayCompatibility, StoredBattleReplay } from './pvp.types'
import { battleReplayEnvelopeSchema, playableBattleSnapshotSchema } from './pvp.replay.schemas'

export const MIN_PLAYABLE_REPLAY_VERSION = 2

export function getReplayCompatibility(snapshotVersion: number): ReplayCompatibility {
  const base = { snapshotVersion, currentVersion: CURRENT_SIMULATION_VERSION }
  if (!Number.isInteger(snapshotVersion) || snapshotVersion < MIN_PLAYABLE_REPLAY_VERSION) {
    return {
      ...base,
      status: 'unsupported',
      canPlay: false,
      visuallyApproximate: false,
      reason: 'invalid_version',
    }
  }
  if (snapshotVersion > CURRENT_SIMULATION_VERSION) {
    return {
      ...base,
      status: 'unsupported',
      canPlay: false,
      visuallyApproximate: false,
      reason: 'newer_engine',
    }
  }
  if (snapshotVersion < CURRENT_SIMULATION_VERSION) {
    return {
      ...base,
      status: 'legacy_approximate',
      canPlay: true,
      visuallyApproximate: true,
      reason: 'older_engine',
    }
  }
  return {
    ...base,
    status: 'current',
    canPlay: true,
    visuallyApproximate: false,
  }
}

export function parseBattleReplayResponse(value: unknown): StoredBattleReplay | null {
  const envelope = battleReplayEnvelopeSchema.safeParse(value)
  if (!envelope.success) return null

  const snapshot = envelope.data.snapshot
  const compatibility = getReplayCompatibility(snapshot.version)
  if (!compatibility.canPlay) {
    return {
      initialState: [],
      logs: [],
      simulationVersion: snapshot.version,
      terminationReason: snapshot.termination_reason ?? undefined,
      elapsedTicks: snapshot.elapsed_ticks ?? undefined,
      compatibility,
    }
  }

  const playable = playableBattleSnapshotSchema.safeParse(snapshot)
  if (!playable.success) return null
  return {
    initialState: playable.data.initial_state as SimUnit[],
    logs: playable.data.log as BattleTick[],
    simulationVersion: snapshot.version,
    terminationReason: snapshot.termination_reason ?? undefined,
    elapsedTicks: snapshot.elapsed_ticks ?? undefined,
    compatibility,
  }
}

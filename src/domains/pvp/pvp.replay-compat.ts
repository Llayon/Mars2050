import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleTick, SimUnit } from '@/domains/combat/combat.types'
import type { ReplayCompatibility, StoredBattleReplay } from './pvp.types'
import { battleReplayEnvelopeSchema, playableBattleSnapshotSchema } from './pvp.replay.schemas'
import { z } from 'zod'

export const MIN_PLAYABLE_REPLAY_VERSION = 2
const replayMetricsSchema = z.object({ engineRevision: z.string().min(1) }).passthrough()

export function getReplayEngineRevision(metrics: unknown): string | undefined {
  const parsed = replayMetricsSchema.safeParse(metrics)
  return parsed.success ? parsed.data.engineRevision : undefined
}

export function getReplayCompatibility(snapshotVersion: number, snapshotRevision?: string): ReplayCompatibility {
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
  if (snapshotRevision !== CURRENT_SIMULATION_REVISION) {
    return {
      ...base,
      status: 'unsupported',
      canPlay: false,
      visuallyApproximate: false,
      reason: 'engine_revision_mismatch',
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
  const snapshotRevision = getReplayEngineRevision(snapshot.metrics)
  const compatibility = getReplayCompatibility(snapshot.version, snapshotRevision)
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

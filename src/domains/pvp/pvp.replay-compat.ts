import { CURRENT_SIMULATION_REVISION, CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleTick, SimUnit } from '@/domains/combat/combat.types'
import { combatMetadataSchema, checkIdentityCompatibility, type CombatMetadata } from '@mars2050/combat-core/contracts'
import type { ReplayCompatibility, StoredBattleReplay } from './pvp.types'
import { battleReplayEnvelopeSchema, playableBattleSnapshotSchema } from './pvp.replay.schemas'
import { z } from 'zod'

export const MIN_PLAYABLE_REPLAY_VERSION = 2
const replayMetricsSchema = z.object({ engineRevision: z.string().min(1) }).passthrough()

export function getReplayEngineRevision(metrics: unknown): string | undefined {
  const parsed = replayMetricsSchema.safeParse(metrics)
  return parsed.success ? parsed.data.engineRevision : undefined
}

export function getReplayCompatibility(
  snapshotVersion: number,
  snapshotRevision?: string,
  metadata?: CombatMetadata | null
): ReplayCompatibility {
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
  if (metadata) {
    const identity = checkIdentityCompatibility(metadata, {})
    if (!identity.compatible) {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'identity_incompatible',
        reasons: identity.reasons,
      }
    }

    if (snapshotVersion === 9 && metadata.engine.defenseResolutionMode !== 'v9_snapshot') {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'identity_incompatible',
        reasons: [`Snapshot version 9 contradicts defense resolution mode "${metadata.engine.defenseResolutionMode}"`],
      }
    }
    if (snapshotVersion === 8 && metadata.engine.defenseResolutionMode !== 'v8_sequential') {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'identity_incompatible',
        reasons: [`Snapshot version 8 contradicts defense resolution mode "${metadata.engine.defenseResolutionMode}"`],
      }
    }
    if (snapshotVersion < 8) {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'identity_incompatible',
        reasons: [`Historical snapshot version ${snapshotVersion} cannot carry engine metadata`],
      }
    }

    if (snapshotVersion === CURRENT_SIMULATION_VERSION && metadata.engine.revision !== CURRENT_SIMULATION_REVISION) {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'engine_revision_mismatch',
        reasons: [`Engine revision mismatch: expected "${CURRENT_SIMULATION_REVISION}", got "${metadata.engine.revision}"`],
      }
    }

    if (snapshotRevision !== undefined && snapshotRevision !== metadata.engine.revision) {
      return {
        ...base,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'engine_revision_mismatch',
        reasons: [`Legacy engine revision "${snapshotRevision}" contradicts metadata revision "${metadata.engine.revision}"`],
      }
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
  const rawMetrics = snapshot.metrics && typeof snapshot.metrics === 'object' && !Array.isArray(snapshot.metrics)
    ? (snapshot.metrics as Record<string, unknown>)
    : undefined
  const rawMetadata = (snapshot as { metadata?: unknown }).metadata ?? rawMetrics?.metadata

  let metadata: CombatMetadata | undefined
  let metadataMalformed = false

  if (rawMetadata !== undefined && rawMetadata !== null) {
    const metaParse = combatMetadataSchema.safeParse(rawMetadata)
    if (metaParse.success) {
      metadata = metaParse.data
    } else {
      metadataMalformed = true
    }
  }

  const compatibility: ReplayCompatibility = metadataMalformed
    ? {
        snapshotVersion: snapshot.version,
        currentVersion: CURRENT_SIMULATION_VERSION,
        status: 'unsupported',
        canPlay: false,
        visuallyApproximate: false,
        reason: 'malformed_metadata',
        reasons: ['Combat metadata envelope is malformed or invalid'],
      }
    : getReplayCompatibility(snapshot.version, snapshotRevision, metadata)
  if (!compatibility.canPlay) {
    return {
      initialState: [],
      logs: [],
      simulationVersion: snapshot.version,
      terminationReason: snapshot.termination_reason ?? undefined,
      elapsedTicks: snapshot.elapsed_ticks ?? undefined,
      compatibility,
      ...(metadata !== undefined ? { metadata } : {}),
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
    ...(metadata !== undefined ? { metadata } : {}),
  }
}

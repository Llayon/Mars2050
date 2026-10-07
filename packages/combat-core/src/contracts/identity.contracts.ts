import { z } from 'zod'

export const defenseResolutionModeSchema = z.enum(['v9_snapshot', 'v8_sequential'])
export type DefenseResolutionMode = z.infer<typeof defenseResolutionModeSchema>

/**
 * Public combat-core contract API version.
 * Origin: semantic version of public input and output shapes.
 */
export const PUBLIC_CONTRACT_VERSION = '1.0.0'

/**
 * Build identifier for @mars2050/combat-core engine.
 * Origin: package distribution name.
 */
export const ENGINE_ID = '@mars2050/combat-core'

/**
 * Build version matching package.json.
 * Origin: package release version.
 */
export const ENGINE_VERSION = '0.1.0'

/**
 * Replay wire schema identifier and version.
 * Origin: wire serialization format for snapshots and ticks.
 */
export const REPLAY_SCHEMA_ID = 'combat-replay'
export const REPLAY_SCHEMA_VERSION = '1.0.0'

/**
 * Independent reproducible build identifier for @mars2050/combat-core.
 * Origin: source-bound isolation snapshot.
 */
export const ENGINE_BUILD_ID = 'combat-core-r5a-20261007'

export const engineIdentitySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  revision: z.string().min(1),
  buildId: z.string().min(1),
  defenseResolutionMode: defenseResolutionModeSchema,
})
export type EngineIdentity = z.infer<typeof engineIdentitySchema>

export const rulesetIdentitySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a 64-character lowercase hex SHA-256 hash'),
})
export type RulesetIdentity = z.infer<typeof rulesetIdentitySchema>

export const replaySchemaIdentitySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
})
export type ReplaySchemaIdentity = z.infer<typeof replaySchemaIdentitySchema>

export const combatMetadataSchema = z.object({
  contractVersion: z.string().min(1),
  engine: engineIdentitySchema,
  ruleset: rulesetIdentitySchema,
  replaySchema: replaySchemaIdentitySchema,
})
export type CombatMetadata = z.infer<typeof combatMetadataSchema>

export interface IdentityCompatibilityTarget {
  revision?: string
  defenseResolutionMode?: DefenseResolutionMode
  contractVersion?: string
  replaySchemaId?: string
  replaySchemaVersion?: string
  engineId?: string
  engineVersion?: string
  buildId?: string
}

export interface IdentityCompatibilityReport {
  compatible: boolean
  reasons: string[]
}


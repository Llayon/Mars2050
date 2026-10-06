import type { BattleInput } from './battle.contracts.js'
import {
  type CombatMetadata,
  type RulesetIdentity,
  type IdentityCompatibilityReport,
  type IdentityCompatibilityTarget,
  PUBLIC_CONTRACT_VERSION,
  REPLAY_SCHEMA_ID,
  REPLAY_SCHEMA_VERSION,
  ENGINE_ID,
  ENGINE_VERSION,
} from './identity.contracts.js'

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

const K_CONSTANTS: number[] = []
const INITIAL_HASH: number[] = []
let primeCount = 0
const compositeMap: Record<number, number> = {}
for (let c = 2; primeCount < 64; c++) {
  if (!compositeMap[c]) {
    for (let i = 0; i < 313; i += c) compositeMap[i] = c
    INITIAL_HASH[primeCount] = (Math.pow(c, 0.5) * 4294967296) | 0
    K_CONSTANTS[primeCount++] = (Math.pow(c, 1 / 3) * 4294967296) | 0
  }
}

/**
 * Deterministic standard SHA-256 implementation in pure TypeScript.
 * Zero external dependencies, runs identically across Node and browser environments.
 * @param str Input string to hash
 * @returns 64-character lowercase hexadecimal hash digest
 */
export function pureSha256(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const bitLength = bytes.length * 8
  const words: number[] = []
  let currentHash = INITIAL_HASH.slice(0, 8)

  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] |= bytes[i] << ((3 - (i % 4)) * 8)
  }
  words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8)
  while ((words.length % 16) !== 14) words.push(0)
  words.push((bitLength / 4294967296) | 0)
  words.push(bitLength | 0)

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16)
    const oldHash = currentHash.slice(0)
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2]
      const a = currentHash[0], e = currentHash[4]
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & currentHash[5]) ^ ((~e) & currentHash[6])
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
      const s1w = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
      const expanded = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1w) | 0
      w[i] = expanded
      const temp1 = (currentHash[7] + s1 + ch + K_CONSTANTS[i] + expanded) | 0
      const s0a = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & currentHash[1]) ^ (a & currentHash[2]) ^ (currentHash[1] & currentHash[2])
      const temp2 = (s0a + maj) | 0
      currentHash = [(temp1 + temp2) | 0].concat(currentHash.slice(0, 7))
      currentHash[4] = (currentHash[4] + temp1) | 0
    }
    for (let i = 0; i < 8; i++) {
      currentHash[i] = (currentHash[i] + oldHash[i]) | 0
    }
  }

  let result = ''
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (currentHash[i] >> (8 * j)) & 255
      result += (b < 16 ? '0' : '') + b.toString(16)
    }
  }
  return result
}

/**
 * Recursively canonicalizes a value for deterministic hashing without mutating input.
 * Sorts object keys lexicographically, normalizes -0 to 0, and preserves array element order.
 * @param val The value to canonicalize
 * @returns A new canonicalized copy
 */
export function canonicalizeValue(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    if (typeof val === 'number') {
      return Object.is(val, -0) ? 0 : val
    }
    return val
  }
  if (Array.isArray(val)) {
    return val.map(item => canonicalizeValue(item))
  }
  const obj = val as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const result: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    if (obj[k] !== undefined) {
      result[k] = canonicalizeValue(obj[k])
    }
  }
  return result
}

/**
 * Computes deterministic ruleset identity and contentHash from a BattleInput.
 * Ruleset identity comprises rules configuration, unit definitions, and optional catalog,
 * without including per-battle seed, obstacles, or spawned units.
 * @param input BattleInput containing rules, definitions, and optional catalog
 * @returns RulesetIdentity with id, version, and 64-char hex contentHash
 */
export function computeRulesetIdentity(input: BattleInput): RulesetIdentity {
  const rulesetId = input.rulesetId ?? input.rules.rulesetId ?? 'standard'
  const rulesetVersion = input.rulesetVersion ?? input.rules.rulesetVersion ?? '1.0.0'
  const canonicalData = {
    rulesetId,
    rulesetVersion,
    rules: {
      maxTicks: input.rules.maxTicks ?? 2000,
      timeoutPolicy: input.rules.timeoutPolicy ?? 'draw',
      defenseResolutionMode: input.rules.defenseResolutionMode ?? 'v9_snapshot',
    },
    definitions: canonicalizeValue(input.definitions),
    ...(input.catalog ? { catalog: canonicalizeValue(input.catalog) } : {}),
  }
  const jsonStr = JSON.stringify(canonicalData)
  const contentHash = pureSha256(jsonStr)
  return {
    id: rulesetId,
    version: rulesetVersion,
    contentHash,
  }
}

/**
 * Checks whether stored replay metadata is compatible with a target engine build.
 * Validates engine revision, defense mode, contract major version, replay schema, and engine version.
 * @param replayMetadata Metadata envelope from a stored replay
 * @param target Target engine build parameters to verify against
 * @returns Compatibility report with status and human-readable mismatch reasons
 */
export function checkIdentityCompatibility(
  replayMetadata: CombatMetadata,
  target: IdentityCompatibilityTarget,
): IdentityCompatibilityReport {
  const reasons: string[] = []
  if (target.revision !== undefined && replayMetadata.engine.revision !== target.revision) {
    reasons.push(`Engine revision mismatch: expected "${target.revision}", got "${replayMetadata.engine.revision}"`)
  }
  if (target.defenseResolutionMode !== undefined && replayMetadata.engine.defenseResolutionMode !== target.defenseResolutionMode) {
    reasons.push(`Defense resolution mode mismatch: expected "${target.defenseResolutionMode}", got "${replayMetadata.engine.defenseResolutionMode}"`)
  }

  const expectedContract = target.contractVersion ?? PUBLIC_CONTRACT_VERSION
  const [metaContractMajor] = (replayMetadata.contractVersion ?? '').split('.')
  const [expContractMajor] = expectedContract.split('.')
  if (metaContractMajor !== expContractMajor) {
    reasons.push(`Contract version incompatible: expected major "${expContractMajor}", got "${replayMetadata.contractVersion}"`)
  }

  const expectedSchemaId = target.replaySchemaId ?? REPLAY_SCHEMA_ID
  if (replayMetadata.replaySchema.id !== expectedSchemaId) {
    reasons.push(`Replay schema id mismatch: expected "${expectedSchemaId}", got "${replayMetadata.replaySchema.id}"`)
  }
  const expectedSchemaVer = target.replaySchemaVersion ?? REPLAY_SCHEMA_VERSION
  const [schemaMajor] = (replayMetadata.replaySchema.version ?? '').split('.')
  const [expSchemaMajor] = expectedSchemaVer.split('.')
  if (schemaMajor !== expSchemaMajor) {
    reasons.push(`Replay schema version incompatible: expected major "${expSchemaMajor}", got "${replayMetadata.replaySchema.version}"`)
  }

  const expectedEngineId = target.engineId ?? ENGINE_ID
  if (replayMetadata.engine.id !== expectedEngineId) {
    reasons.push(`Engine id mismatch: expected "${expectedEngineId}", got "${replayMetadata.engine.id}"`)
  }

  const expectedEngineVer = target.engineVersion ?? ENGINE_VERSION
  const [engMajor, engMinor] = (replayMetadata.engine.version ?? '').split('.')
  const [expEngMajor, expEngMinor] = expectedEngineVer.split('.')
  if (engMajor !== expEngMajor || (engMajor === '0' && engMinor !== expEngMinor)) {
    reasons.push(`Engine version incompatible: expected compatible with "${expectedEngineVer}", got "${replayMetadata.engine.version}"`)
  }

  if (target.buildId !== undefined && replayMetadata.engine.buildId !== undefined && replayMetadata.engine.buildId !== target.buildId) {
    reasons.push(`Engine build mismatch: expected "${target.buildId}", got "${replayMetadata.engine.buildId}"`)
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  }
}

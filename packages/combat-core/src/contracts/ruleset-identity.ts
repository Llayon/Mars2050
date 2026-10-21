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

const UTF8_ENCODER = new TextEncoder()

/**
 * Deterministic standard SHA-256 implementation in pure TypeScript.
 * Zero external dependencies, runs identically across Node and browser environments.
 *
 * The compression function keeps the eight working variables and one 64-word message schedule in
 * locals instead of rebuilding the state array every round, so a 146 KB canonical ruleset payload
 * no longer allocates ~16 000 short-lived arrays. Every 32-bit operation, constant, rotation and
 * byte order is unchanged, and the digest is pinned against `node:crypto` by the test suite.
 * @param str Input string to hash
 * @returns 64-character lowercase hexadecimal hash digest
 */
export function pureSha256(str: string): string {
  const bytes = UTF8_ENCODER.encode(str)
  const bitLength = bytes.length * 8
  const blockWords = (((bytes.length + 8) >> 6) + 1) * 16
  const words = new Int32Array(blockWords)

  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] |= bytes[i] << ((3 - (i % 4)) * 8)
  }
  words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8)
  words[blockWords - 2] = (bitLength / 4294967296) | 0
  words[blockWords - 1] = bitLength | 0

  let h0 = INITIAL_HASH[0] | 0
  let h1 = INITIAL_HASH[1] | 0
  let h2 = INITIAL_HASH[2] | 0
  let h3 = INITIAL_HASH[3] | 0
  let h4 = INITIAL_HASH[4] | 0
  let h5 = INITIAL_HASH[5] | 0
  let h6 = INITIAL_HASH[6] | 0
  let h7 = INITIAL_HASH[7] | 0
  const schedule = new Int32Array(64)

  for (let block = 0; block < blockWords; block += 16) {
    for (let i = 0; i < 16; i++) schedule[i] = words[block + i]
    for (let i = 16; i < 64; i++) {
      const w15 = schedule[i - 15]
      const w2 = schedule[i - 2]
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
      schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) | 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ ((~e) & g)
      const temp1 = (h + s1 + ch + K_CONSTANTS[i] + schedule[i]) | 0
      const s0a = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0a + maj) | 0
      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }

  const state = [h0, h1, h2, h3, h4, h5, h6, h7]
  let result = ''
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (state[i] >> (8 * j)) & 255
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

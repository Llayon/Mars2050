import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  simulateCombat,
  type BattleInput,
  type UnitDefinition,
  type CombatMetadata,
  pureSha256,
  computeRulesetIdentity,
  checkIdentityCompatibility,
  PUBLIC_CONTRACT_VERSION,
  ENGINE_ID,
  ENGINE_VERSION,
  ENGINE_BUILD_ID,
  REPLAY_SCHEMA_ID,
  REPLAY_SCHEMA_VERSION,
  combatMetadataSchema,
} from '../src/index.js'
import { decodeLegacyReplayJson, encodeLegacyReplayJson } from '../src/replay/legacy-wire-codec.js'

function makeBaseInput(): BattleInput {
  const definitions: Record<string, UnitDefinition> = {
    soldier: {
      id: 'soldier',
      name: 'Soldier',
      baseStats: {
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 2,
        speed: 15,
        range: 40,
        actionCooldownMax: 10,
        actionCooldown: 0,
        canTargetAir: false,
        size: 'M',
        attackType: 'single',
        aggroLockTicks: 5,
        turnSpeed: 10,
        combatTags: [],
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

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) deepFreeze(val)
  }
  return obj
}

describe('R4b / ISO-11: Separate identities for contract, engine, ruleset, and replay', () => {
  it('pureSha256 matches node:crypto across test vectors', () => {
    const vectors = ['', 'abc', 'hello world', '{"a":1,"b":2}', 'тест детерминизма марса 🚀']
    for (const v of vectors) {
      const custom = pureSha256(v)
      const expected = createHash('sha256').update(v).digest('hex')
      expect(custom).toBe(expected)
    }
  })

  it('preserves same engine identity for two different rulesets (1 engine / 2 rulesets)', () => {
    const inputMars = { ...makeBaseInput(), rulesetId: 'mars-standard', rulesetVersion: '1.0.0' }
    const inputFantasy: BattleInput = {
      ...makeBaseInput(),
      rulesetId: 'fantasy-standard',
      rulesetVersion: '2.0.0',
      definitions: {
        ...makeBaseInput().definitions,
        knight: {
          id: 'knight',
          name: 'Knight',
          squadSize: 1,
          squadSpacing: 20,
          formation: 'grid',
          baseStats: { ...makeBaseInput().definitions.soldier.baseStats, hp: 200, maxHp: 200 },
        },
      },
    }

    const resultMars = simulateCombat(inputMars)
    const resultFantasy = simulateCombat(inputFantasy)

    expect(resultMars.metadata).toBeDefined()
    expect(resultFantasy.metadata).toBeDefined()
    const metaM = resultMars.metadata as CombatMetadata
    const metaF = resultFantasy.metadata as CombatMetadata

    // Engine identity MUST match identically
    expect(metaM.engine.id).toBe(ENGINE_ID)
    expect(metaF.engine.id).toBe(ENGINE_ID)
    expect(metaM.engine.version).toBe(ENGINE_VERSION)
    expect(metaF.engine.version).toBe(ENGINE_VERSION)
    expect(metaM.engine.revision).toBe(metaF.engine.revision)
    expect(metaM.engine.buildId).toBe(ENGINE_BUILD_ID)
    expect(metaF.engine.buildId).toBe(ENGINE_BUILD_ID)
    expect(metaM.engine.defenseResolutionMode).toBe(metaF.engine.defenseResolutionMode)

    // Contract and replay schema identity match
    expect(metaM.contractVersion).toBe(PUBLIC_CONTRACT_VERSION)
    expect(metaF.contractVersion).toBe(PUBLIC_CONTRACT_VERSION)
    expect(metaM.replaySchema.id).toBe(REPLAY_SCHEMA_ID)
    expect(metaM.replaySchema.version).toBe(REPLAY_SCHEMA_VERSION)

    // Ruleset identities MUST diverge
    expect(metaM.ruleset.id).toBe('mars-standard')
    expect(metaF.ruleset.id).toBe('fantasy-standard')
    expect(metaM.ruleset.version).toBe('1.0.0')
    expect(metaF.ruleset.version).toBe('2.0.0')
    expect(metaM.ruleset.contentHash).not.toBe(metaF.ruleset.contentHash)
  })

  it('ruleset contentHash is deterministic, repeatable, and key-order invariant', () => {
    const inputA = makeBaseInput()
    const inputB = makeBaseInput()

    // Permute definition keys: { soldier, drone } vs { drone, soldier }
    inputA.definitions = {
      soldier: makeBaseInput().definitions.soldier,
      drone: { id: 'drone', name: 'Drone', squadSize: 1, squadSpacing: 20, formation: 'grid', baseStats: { ...makeBaseInput().definitions.soldier.baseStats, hp: 40 } },
    }
    inputB.definitions = {
      drone: { id: 'drone', name: 'Drone', squadSize: 1, squadSpacing: 20, formation: 'grid', baseStats: { ...makeBaseInput().definitions.soldier.baseStats, hp: 40 } },
      soldier: makeBaseInput().definitions.soldier,
    }

    const idA = computeRulesetIdentity(inputA)
    const idB = computeRulesetIdentity(inputB)
    expect(idA.contentHash).toBe(idB.contentHash)
    expect(idA.contentHash).toHaveLength(64)
  })

  it('ruleset contentHash is sensitive to stats, rules, and modes (mutation check)', () => {
    const base = makeBaseInput()
    const baseHash = computeRulesetIdentity(base).contentHash

    // Stat change
    const mutatedHp = makeBaseInput()
    mutatedHp.definitions.soldier.baseStats.hp = 101
    expect(computeRulesetIdentity(mutatedHp).contentHash).not.toBe(baseHash)

    // Timeout policy change
    const mutatedTimeout = makeBaseInput()
    mutatedTimeout.rules.timeoutPolicy = 'attacker_win'
    expect(computeRulesetIdentity(mutatedTimeout).contentHash).not.toBe(baseHash)

    // Defense resolution mode change
    const mutatedDefense = makeBaseInput()
    mutatedDefense.rules.defenseResolutionMode = 'v8_sequential'
    expect(computeRulesetIdentity(mutatedDefense).contentHash).not.toBe(baseHash)

    // Max ticks change
    const mutatedTicks = makeBaseInput()
    mutatedTicks.rules.maxTicks = 500
    expect(computeRulesetIdentity(mutatedTicks).contentHash).not.toBe(baseHash)

    // Array element order sensitivity in abilities
    const withAbilitiesA = makeBaseInput()
    withAbilitiesA.definitions.soldier.abilities = [
      { id: 'ab1', name: 'Slash', cooldown: 10, priority: 1 },
      { id: 'ab2', name: 'Bash', cooldown: 20, priority: 2 },
    ]
    const withAbilitiesB = makeBaseInput()
    withAbilitiesB.definitions.soldier.abilities = [
      { id: 'ab2', name: 'Bash', cooldown: 20, priority: 2 },
      { id: 'ab1', name: 'Slash', cooldown: 10, priority: 1 },
    ]
    expect(computeRulesetIdentity(withAbilitiesA).contentHash).not.toBe(computeRulesetIdentity(withAbilitiesB).contentHash)
  })

  it('guarantees input immutability: deep-frozen input computes hash and simulates without error', () => {
    const frozenInput = deepFreeze(makeBaseInput())
    expect(() => computeRulesetIdentity(frozenInput)).not.toThrow()
    expect(() => simulateCombat(frozenInput)).not.toThrow()
  })

  it('preserves metadata through full JSON serialize/deserialize wire round-trip', () => {
    const input = makeBaseInput()
    const result = simulateCombat(input)
    expect(result.metadata).toBeDefined()

    const json = encodeLegacyReplayJson(result)
    const decoded = decodeLegacyReplayJson(json)

    expect(decoded.metadata).toBeDefined()
    const validated = combatMetadataSchema.safeParse(decoded.metadata)
    expect(validated.success).toBe(true)
    expect(decoded.metadata).toEqual(result.metadata)
  })

  it('preserves valid underscore-prefixed definition IDs and detects stat changes', () => {
    const inputA = makeBaseInput()
    const inputB = makeBaseInput()
    inputA.definitions._soldier = { ...makeBaseInput().definitions.soldier, id: '_soldier', baseStats: { ...makeBaseInput().definitions.soldier.baseStats, attack: 1 } }
    inputB.definitions._soldier = { ...makeBaseInput().definitions.soldier, id: '_soldier', baseStats: { ...makeBaseInput().definitions.soldier.baseStats, attack: 1000 } }

    const hashA = computeRulesetIdentity(inputA).contentHash
    const hashB = computeRulesetIdentity(inputB).contentHash
    expect(hashA).not.toBe(hashB)
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

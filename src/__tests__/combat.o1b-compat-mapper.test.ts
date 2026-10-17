import { describe, it, expect } from 'vitest'
import type { CombatRunResult, CombatEvent, CombatSnapshotUnit, Obstacle } from '@mars2050/combat-core/contracts'
import {
  deserializeCombatAction,
  mapCombatEventToBattleAction,
  serializeCombatUnitSnapshot,
} from '@mars2050/combat-core/replay'
import { mapCombatRunResultToBattleResult } from '../domains/combat/combat.compat-mapper'
import { simulateCombat } from '../domains/combat/combat.facade'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'
import type { BattleResult } from '../domains/combat/combat.types'
import {
  deserializeCombatAction as r7DeserializeCombatAction,
  deserializeCombatUnitSnapshot as r7DeserializeCombatUnitSnapshot,
} from './fixtures/r7-legacy-wire-codec'

const PRESET_IDS = ['massive_clash', 'ranged_duel', 'summon_caps', 'zerg_rush'] as const
type PresetId = (typeof PRESET_IDS)[number]
const SEED = 24680
const BATTLE_TIMEOUT_MS = 60_000
const battleCache = new Map<PresetId, CombatRunResult>()

/**
 * Runs a simulator preset through the Mars adapter and caches the immutable core result.
 * @param presetId - Simulator preset identifier.
 * @returns Deterministic CombatRunResult for the shared seed.
 */
function combatRun(presetId: PresetId): CombatRunResult {
  const cached = battleCache.get(presetId)
  if (cached) return cached
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const input = translateMarsBattleInput(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })
  const result = simulateCombat(input)
  battleCache.set(presetId, result)
  return result
}

/**
 * Independent R7 reference pipeline.
 *
 * Mirrors commit 177b213 `src/domains/combat/combat.compat-mapper.ts` line-for-line,
 * but the deserializers come from the pinned R7 fixture (`./fixtures/r7-legacy-wire-codec`),
 * never from candidate package code, so an O1 regression cannot satisfy this oracle.
 * @param result - Core battle result to map.
 * @param obstacles - Obstacles forwarded to the Mars DTO.
 * @returns R7-equivalent BattleResult.
 */
function r7ReferenceMap(result: CombatRunResult, obstacles: Obstacle[] = []): BattleResult {
  const profileMetrics = result.metrics ?? result.profile?.metrics
  const profileSpatial = result.profile?.spatial ?? result.profile
  return {
    winner: result.winner,
    logs: result.logs.map(tick => ({
      tick: tick.tick,
      actions: tick.actions.map(action => r7DeserializeCombatAction(action)),
    })),
    seed: result.seed,
    initialState: result.initialState.map(unit => r7DeserializeCombatUnitSnapshot(unit)),
    survivors: result.survivors.map(unit => r7DeserializeCombatUnitSnapshot(unit)),
    obstacles,
    metrics: profileMetrics as unknown as BattleResult['metrics'],
    terminationReason: result.terminationReason as BattleResult['terminationReason'],
    elapsedTicks: result.elapsedTicks,
    simulationVersion: result.engineVersion,
    simulationRevision: result.engineRevision,
    profile: profileSpatial as unknown as BattleResult['profile'],
    metadata: result.metadata,
  }
}

/**
 * Recursively mutates every primitive leaf in place (test-only helper).
 * @param node - Arbitrary JSON-like tree to corrupt.
 */
function mutateDeep(node: unknown): void {
  if (Array.isArray(node)) { for (const item of node) mutateDeep(item); return }
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (typeof value === 'number') record[key] = value + 1_000_000
    else if (typeof value === 'string') record[key] = 'corrupted'
    else if (typeof value === 'boolean') record[key] = !value
    else mutateDeep(value)
  }
}

/**
 * Collects every distinct wire event produced by the given presets.
 * @param presetIds - Presets whose battle logs are scanned.
 * @returns Deduplicated events keyed by their JSON representation.
 */
function collectDistinctEvents(presetIds: readonly PresetId[]): Map<string, CombatEvent> {
  const distinct = new Map<string, CombatEvent>()
  for (const presetId of presetIds) {
    for (const tick of combatRun(presetId).logs) {
      for (const action of tick.actions) {
        const key = JSON.stringify(action)
        if (!distinct.has(key)) distinct.set(key, action)
      }
    }
  }
  return distinct
}

describe('O1-B: Mars adapter equivalence vs pinned R7 oracle', () => {
  it.each(PRESET_IDS)('maps preset %s identically to the R7 oracle (deep + wire order)', presetId => {
    const result = combatRun(presetId)
    expect(result.logs.length).toBeGreaterThan(0)

    const optimized = mapCombatRunResultToBattleResult(result, [])
    const reference = r7ReferenceMap(result)

    expect(optimized).toEqual(reference)
    expect(JSON.stringify(optimized)).toBe(JSON.stringify(reference))
  }, BATTLE_TIMEOUT_MS)

  it('maps the JSON wire round-trip of massive_clash identically to the R7 oracle', () => {
    const result = combatRun('massive_clash')
    const wire = JSON.parse(JSON.stringify(result)) as CombatRunResult

    const optimized = mapCombatRunResultToBattleResult(wire, [])
    const reference = r7ReferenceMap(wire)

    expect(JSON.stringify(optimized)).toBe(JSON.stringify(reference))
  }, BATTLE_TIMEOUT_MS)

  it('maps every distinct real combat event from all presets identically to the R7 codec', () => {
    const distinct = collectDistinctEvents(PRESET_IDS)
    expect(distinct.size).toBeGreaterThan(100)

    const eventTypes = new Set<string>()
    for (const event of distinct.values()) {
      eventTypes.add(event.type)
      const optimized = mapCombatEventToBattleAction(event)
      const reference = r7DeserializeCombatAction(event)
      expect(JSON.stringify(optimized), `event ${event.type}: ${JSON.stringify(event)}`).toBe(
        JSON.stringify(reference),
      )
    }
    expect(eventTypes.size).toBeGreaterThan(5)
  }, BATTLE_TIMEOUT_MS)

  it('maps every distinct real snapshot unit identically to the R7 codec', () => {
    const distinctUnits = new Map<string, CombatSnapshotUnit>()
    for (const presetId of PRESET_IDS) {
      const result = combatRun(presetId)
      for (const unit of [...result.initialState, ...result.survivors]) {
        const key = JSON.stringify(unit)
        if (!distinctUnits.has(key)) distinctUnits.set(key, unit)
      }
    }
    expect(distinctUnits.size).toBeGreaterThan(5)

    for (const unit of distinctUnits.values()) {
      const optimized = serializeCombatUnitSnapshot(unit)
      const reference = r7DeserializeCombatUnitSnapshot(unit)
      expect(JSON.stringify(optimized), `unit ${unit.id}`).toBe(JSON.stringify(reference))
    }
  }, BATTLE_TIMEOUT_MS)

  it('does not mutate or alias the source CombatRunResult in deeply mapped regions', () => {
    const result = combatRun('ranged_duel')
    const before = JSON.stringify(result)

    const mapped = mapCombatRunResultToBattleResult(result, [])
    expect(JSON.stringify(result)).toBe(before)

    // logs/initialState/survivors are the regions O1-B rewrites; corrupting every
    // leaf of the mapped output must not leak back into the source result.
    // (Top-level pass-through fields like metadata/metrics/profile are aliased by the
    // R7 mapper as well — see 177b213 combat.compat-mapper.ts — and stay untouched here.)
    mutateDeep(mapped.logs)
    mutateDeep(mapped.initialState)
    mutateDeep(mapped.survivors)
    expect(JSON.stringify(result)).toBe(before)

    const remapped = mapCombatRunResultToBattleResult(result, [])
    expect(JSON.stringify(remapped)).toBe(JSON.stringify(r7ReferenceMap(result)))
  }, BATTLE_TIMEOUT_MS)

  it('keeps battle A mapping stable across battle B runs and repeated mapping', () => {
    const resultA = combatRun('ranged_duel')
    const mapA1 = mapCombatRunResultToBattleResult(resultA, [])
    const jsonA1 = JSON.stringify(mapA1)

    const resultB = combatRun('massive_clash')
    expect(resultB.logs.length).toBeGreaterThan(0)
    expect(JSON.stringify(mapCombatRunResultToBattleResult(resultA, []))).toBe(jsonA1)

    const resultA2 = combatRun('ranged_duel')
    expect(resultA2).toBe(resultA)
    expect(JSON.stringify(mapCombatRunResultToBattleResult(resultA2, []))).toBe(jsonA1)
  }, BATTLE_TIMEOUT_MS)

  it('keeps full R7 validation with identical error messages on the public parsers', () => {
    const malformed: unknown[] = [
      { type: 'move' },
      {},
      { type: 'custom_event' },
      { type: 'spawn', unitId: 'u1', spawnTeam: 'neutral' },
      { type: 'spawn', unitId: 'u1', spawnMaxHp: 0 },
      { type: 'mystery', unknownField: 1 },
      { type: 'custom_event', details: { bad: Number.NaN } },
    ]

    for (const input of malformed) {
      let candidateError: unknown
      try {
        deserializeCombatAction(input)
      } catch (error) {
        candidateError = error
      }
      let referenceError: unknown
      try {
        r7DeserializeCombatAction(input)
      } catch (error) {
        referenceError = error
      }
      expect(candidateError, `candidate must reject ${JSON.stringify(input)}`).toBeDefined()
      expect(referenceError, `R7 oracle must reject ${JSON.stringify(input)}`).toBeDefined()
      expect((candidateError as Error).message, `message parity for ${JSON.stringify(input)}`).toBe(
        (referenceError as Error).message,
      )
    }

    // Sanitizing parser: private keys are stripped before validation by both implementations.
    const withPrivateKeys = { type: 'custom_event', unitId: 'u1', details: { _secret: 1, visible: 2 } }
    expect(deserializeCombatAction(withPrivateKeys)).toEqual(r7DeserializeCombatAction(withPrivateKeys))
  })

  it('keeps the internal mapper guard messages identical to the R7 codec guards', () => {
    expect(() => mapCombatEventToBattleAction({ type: 'move' } as unknown as CombatEvent)).toThrowError(
      'BattleAction requires a valid non-empty unitId or sourceId',
    )
    expect(() =>
      mapCombatEventToBattleAction({
        type: 'spawn',
        unitId: 'u1',
        spawnTeam: 'neutral' as unknown as 'attacker' | 'defender',
      }),
    ).toThrowError('Invalid spawnTeam: expected "attacker" | "defender", got neutral')
    expect(() =>
      mapCombatEventToBattleAction({ type: 'spawn', unitId: 'u1', spawnMaxHp: Infinity }),
    ).toThrowError('Invalid spawnMaxHp: must be a positive number, got Infinity')
  })
})

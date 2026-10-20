import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateBattleInput } from '../src/combat.input-validator.js'
import { PRNG } from '../src/math/index.js'
import { createEcsCombatRuntime } from '../src/ecs/combat-ecs-runtime.js'
import { compileSpawnSpecBundles } from '../src/combat.spawn-spec-compiler.js'
import { createPathfindingMap } from '../src/combat.pathfinding.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'
import type { BattleAction, BattleInput } from '../src/contracts/index.js'
import type { CombatCatalog } from '../src/combat.catalog.types.js'
import type { TimeoutPolicy } from '../src/combat.result.js'

/** Canonical move actions plus the legacy `sourceId` alias the wire contract still accepts. */
type BattleActionWithLegacySource = BattleAction & { sourceId?: string }

/**
 * CORE-HANDOFF regression: the replay journal must publish every committed world move
 * (small collision corrections included) and must never publish a position the world did
 * not reach. Physics, RNG, balance and non-move ordering are out of scope here.
 */

const DT = 0.1
const ROUND_TOLERANCE = 0.005 + 1e-9
const MRE = {
  'case-1': { unit: 'defender:squad-1_2', lastR7Tick: 584, resumedTicks: [585, 599], living: 5 },
  'case-2': { unit: 'defender:squad-3_3', lastR7Tick: 572, resumedTicks: [573, 589], living: 39 },
} as const

type StepReport = {
  mismatches: Array<{ tick: number; unit: string; delta: number }>
  moveTicksByUnit: Map<string, number[]>
  finalDeltaByUnit: Map<string, number>
  living: number
  elapsedTicks: number
  maxDelta: number
}

function loadMre(name: keyof typeof MRE): BattleInput {
  const url = new URL(`./fixtures/movement-journal/${name}.json`, import.meta.url)
  return validateBattleInput(JSON.parse(readFileSync(url, 'utf8')))
}

function stepWithProjection(input: BattleInput): StepReport {
  const rng = new PRNG(input.seed)
  const arena = input.arena
  const catalog: CombatCatalog = {
    unitTypes: Object.fromEntries(
      Object.entries(input.definitions).map(([key, def]) => [key, mapDefinitionToUnitTypeConfig(def)]),
    ),
    // The zod-inferred input view marks catalog ids optional; the runtime catalog contract requires them.
    upgrades: input.catalog?.upgrades as CombatCatalog['upgrades'],
    targetingProfiles: input.catalog?.targetingProfiles,
  }
  const runtime = createEcsCombatRuntime({
    profile: input.rules.profile === true,
    defenseResolutionMode: input.rules.defenseResolutionMode,
    catalog,
  })
  runtime.world.resources.set('arena', arena)
  for (const spec of input.units) {
    runtime.world.queueCompiledUnitCreation(...compileSpawnSpecBundles(spec, input.definitions, catalog, rng, arena))
  }
  runtime.world.flushStructuralCommands()
  const initialState = runtime.snapshotUnits()

  const obstacles = arena.obstacles
  const resources = runtime.world.resources
  resources.set('clock', {
    tick: 0,
    dt: DT,
    maxTicks: input.rules.maxTicks,
    // Same nominal translation the public runner applies before installing the clock resource.
    timeoutPolicy: input.rules.timeoutPolicy === 'attacker_win'
      ? 'attacker_holds'
      : input.rules.timeoutPolicy === 'defender_win' ? 'defender_holds' : 'draw',
  } satisfies { tick: number; dt: number; maxTicks: number; timeoutPolicy: TimeoutPolicy })
  resources.set('rng', rng)
  resources.set('actions', [] as BattleAction[])
  resources.set('obstacles', obstacles)
  resources.set('arena', arena)
  resources.set('flowField', createPathfindingMap(obstacles, arena))
  resources.set('globals', [])
  resources.set('metrics', undefined)

  const projection = new Map(initialState.map(unit => [unit.id, { x: unit.x, y: unit.y }]))
  const moveTicksByUnit = new Map<string, number[]>()
  const mismatches: StepReport['mismatches'] = []
  let maxDelta = 0

  const publish = (actions: BattleAction[], tick: number): void => {
    for (const action of actions) {
      if (action.type !== 'move') continue
      // The wire contract also accepts a legacy `sourceId` alias for move events.
      const unitId = (action as BattleActionWithLegacySource).sourceId ?? action.unitId
      if (!unitId || !projection.has(unitId)) continue
      if (typeof action.toX !== 'number' || typeof action.toY !== 'number') continue
      projection.set(unitId, { x: action.toX, y: action.toY })
      const ticks = moveTicksByUnit.get(unitId) ?? []
      ticks.push(tick)
      moveTicksByUnit.set(unitId, ticks)
    }
  }
  const verifyTick = (tick: number): void => {
    for (const entityId of runtime.world.query(['identity', 'transform', 'vitality'])) {
      if (runtime.world.stores.vitality.get(entityId)?.isDead) continue
      const unitId = runtime.world.stores.identity.get(entityId)?.id
      const transform = runtime.world.stores.transform.get(entityId)
      const projected = unitId ? projection.get(unitId) : undefined
      if (!projected || !transform) continue
      const delta = Math.max(Math.abs(projected.x - transform.x), Math.abs(projected.y - transform.y))
      if (delta > maxDelta) maxDelta = delta
      if (delta > ROUND_TOLERANCE) mismatches.push({ tick, unit: unitId as string, delta })
    }
  }

  let tick = 0
  while (tick < input.rules.maxTicks) {
    const actions: BattleAction[] = []
    resources.require('clock').tick = tick
    resources.set('actions', actions)
    runtime.runStage('pre_action', { tick, actions, rng, activeGlobals: [] })
    const terminal = runtime.getTerminalOutcome()
    if (terminal) {
      publish(actions, tick)
      if (actions.length > 0) { verifyTick(tick); tick += 1 }
      break
    }
    runtime.runStage('action', { tick, actions, rng, activeGlobals: [] })
    runtime.runStage('post_action', { tick, actions, rng, activeGlobals: [] })
    publish(actions, tick)
    verifyTick(tick)
    tick += 1
  }

  const survivors = runtime.getSurvivors()
  const finalDeltaByUnit = new Map<string, number>()
  for (const survivor of survivors) {
    const projected = projection.get(survivor.id)
    if (!projected) continue
    finalDeltaByUnit.set(survivor.id, Math.max(Math.abs(projected.x - survivor.x), Math.abs(projected.y - survivor.y)))
  }
  return { mismatches, moveTicksByUnit, finalDeltaByUnit, living: survivors.length, elapsedTicks: tick, maxDelta }
}

describe('CORE-HANDOFF: replay journal publishes every committed move', () => {
  for (const name of Object.keys(MRE) as Array<keyof typeof MRE>) {
    it(`keeps the journal consistent with the world on every tick (${name})`, () => {
      const report = stepWithProjection(loadMre(name))
      expect(report.mismatches).toEqual([])
      expect(report.maxDelta).toBeLessThanOrEqual(ROUND_TOLERANCE)
      expect(report.living).toBe(MRE[name].living)
    })

    it(`resumes small movements after the last old journal entry (${name})`, () => {
      const { unit, lastR7Tick, resumedTicks } = MRE[name]
      const report = stepWithProjection(loadMre(name))
      const ticks = report.moveTicksByUnit.get(unit) ?? []
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks[ticks.length - 1]).toBe(resumedTicks[1])
      expect(ticks.filter(t => t > lastR7Tick).length).toBeGreaterThan(1)
      expect(ticks.some(t => t === resumedTicks[0])).toBe(true)
      expect(ticks.some(t => t > resumedTicks[0] && t < resumedTicks[1])).toBe(true)
      for (const row of report.finalDeltaByUnit) {
        expect(row[1]).toBeLessThanOrEqual(ROUND_TOLERANCE)
      }
    })
  }
})

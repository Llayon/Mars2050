import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createEcsCombatRuntime } from '../src/ecs/combat-ecs-runtime.js'
import { compileSpawnSpecBundles } from '../src/combat.spawn-spec-compiler.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'
import { createPathfindingMap } from '../src/combat.pathfinding.js'
import { validateBattleInput } from '../src/combat.input-validator.js'
import { PRNG } from '../src/math/index.js'
import type { BattleAction, BattleInput } from '../src/contracts/index.js'
import type { CombatCatalog } from '../src/combat.catalog.types.js'
import type { TimeoutPolicy } from '../src/combat.result.js'

/**
 * Shared fixtures for the O2 regression suites. Kept out of the *.test.ts files so each suite stays
 * within the repository file-size limit.
 */

export type Definition = BattleInput['definitions'][string]
export type UnitSpec = BattleInput['units'][number]

export const DT = 0.1
export const SEED = 24680

export const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const json = (value: unknown): string => JSON.stringify(value)

export function createDefinition(id: string, over: Record<string, unknown> = {}): Definition {
  return {
    id,
    name: id,
    baseStats: {
      hp: 500,
      attack: 15,
      defense: 2,
      speed: 60,
      range: 40,
      attackType: 'single',
      actionCooldownMax: 10,
      turnSpeed: 5,
      size: 'M',
      combatTags: [],
      ...over,
    },
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
  } as unknown as Definition
}

export function createUnit(
  instanceId: string,
  definitionId: string,
  team: 'attacker' | 'defender',
  x: number,
  y: number,
): UnitSpec {
  return { instanceId, definitionId, team, placement: { x, y }, rank: 1, upgradeIds: [] } as unknown as UnitSpec
}

/** Small 1v1 clash: fixed ids and stats so every run is byte-comparable. */
export function smallBattle(): BattleInput {
  return {
    seed: SEED,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 40, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      knight: createDefinition('knight', { hp: 450, attack: 18, defense: 4 }),
      brute: createDefinition('brute', { hp: 550, attack: 14, defense: 2 }),
    },
    units: [
      createUnit('k1', 'knight', 'attacker', 300, 900),
      createUnit('b1', 'brute', 'defender', 300, 300),
    ],
    scheduledEffects: [],
  } as unknown as BattleInput
}

/** Dense squad clash: many moving neighbours, the case that exercises the per-tick buffers. */
export function largeBattle(attack: number): BattleInput {
  const units: UnitSpec[] = []
  for (let index = 0; index < 6; index += 1) {
    units.push(createUnit(`a${index}`, 'swarm', 'attacker', 200 + index * 40, 900))
    units.push(createUnit(`d${index}`, 'swarm', 'defender', 200 + index * 40, 300))
  }
  return {
    seed: SEED,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 60, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      swarm: createDefinition('swarm', {
        hp: 400, attack, defense: 3, speed: 70, range: 45, squadSize: 8, squadSpacing: 18,
      }),
    },
    units,
    scheduledEffects: [],
  } as unknown as BattleInput
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
    Object.freeze(value)
  }
  return value
}

export function createRuntime(input: BattleInput) {
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
  resources.set('obstacles', arena.obstacles)
  resources.set('flowField', createPathfindingMap(arena.obstacles, arena))
  resources.set('globals', [])
  resources.set('metrics', undefined)
  return { runtime, resources, rng }
}

export function loadMre(name: 'case-1' | 'case-2'): BattleInput {
  const url = new URL(`./fixtures/movement-journal/${name}.json`, import.meta.url)
  return validateBattleInput(JSON.parse(readFileSync(url, 'utf8')))
}

export function runTicks(input: BattleInput, ticks: number): void {
  const { runtime, resources, rng } = createRuntime(input)
  runStages(runtime, resources, rng, ticks)
}

export function runStages(
  runtime: ReturnType<typeof createRuntime>['runtime'],
  resources: ReturnType<typeof createRuntime>['resources'],
  rng: PRNG,
  ticks: number,
): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    const actions: BattleAction[] = []
    resources.require('clock').tick = tick
    resources.set('actions', actions)
    runtime.runStage('pre_action', { tick, actions, rng, activeGlobals: [] })
    if (runtime.getTerminalOutcome()) break
    runtime.runStage('action', { tick, actions, rng, activeGlobals: [] })
    runtime.runStage('post_action', { tick, actions, rng, activeGlobals: [] })
  }
}

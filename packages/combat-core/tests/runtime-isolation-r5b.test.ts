import { describe, expect, it } from 'vitest'
import * as combatCore from '../src/index.js'
import { simulateCombat } from '../src/facade/combat-facade.js'
import { createEcsCombatRuntime } from '../src/ecs/combat-ecs-runtime.js'
import { compileUnitSnapshot } from '../src/combat.unit-compiler.js'
import { PRNG } from '../src/combat.utils.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import type { CombatCatalog } from '../src/combat.catalog.types.js'

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj
  Object.freeze(obj)
  for (const value of Object.values(obj as Record<string, unknown>)) deepFreeze(value)
  return obj
}

function makeArena(width: number, height: number) {
  return { width, height, tileSize: 40, obstacles: [], deployment: { strategy: 'center' as const } }
}

function makeDef(id: string, name: string, hp: number, attack: number, extra: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id, name, squadSize: 1, squadSpacing: 20, formation: 'grid',
    baseStats: { hp, attack, defense: 0, speed: 60, range: 80, attackType: 'single', actionCooldownMax: 10, turnSpeed: 10, size: 'M', combatTags: [], ...extra },
  }
}

function toCatalog(defs: Record<string, UnitDefinition>): CombatCatalog {
  return deepFreeze({ unitTypes: Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, mapDefinitionToUnitTypeConfig(v)])) })
}

describe('R5b / ISO-08: Runtime isolation and elimination of global registries', () => {
  it('does not export global registries or mutable singleton setters from combat-core', () => {
    const exports = combatCore as Record<string, unknown>
    expect(exports.registerDefaultCombatCatalog).toBeUndefined()
    expect(exports.getDefaultCombatCatalog).toBeUndefined()
    expect(exports.defaultCombatCatalog).toBeUndefined()
    expect(exports.registerCombatSimulator).toBeUndefined()
    expect(exports.activeSimulator).toBeUndefined()
  })

  it('runs isolated synchronous alternating battles (A->B->A and B->A->B) over frozen inputs with divergent definitions and arenas', () => {
    const arenaA = makeArena(600, 600)
    const arenaB = makeArena(800, 800)

    const defsA: Record<string, UnitDefinition> = {
      fighter: makeDef('fighter', 'Fighter A (Light)', 120, 15),
      target: makeDef('target', 'Target A', 1000, 0),
    }

    const defsB: Record<string, UnitDefinition> = {
      fighter: makeDef('fighter', 'Fighter B (Heavy)', 600, 40),
      target: makeDef('target', 'Target B', 3000, 0),
    }

    const battleA: BattleInput = deepFreeze({
      seed: 42,
      arena: arenaA,
      rules: { maxTicks: 25, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defsA,
      units: [
        { instanceId: 'a1', definitionId: 'fighter', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 280, y: 300, angle: 0 } },
        { instanceId: 'd1', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 320, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defsA },
      scheduledEffects: [],
    })

    const battleB: BattleInput = deepFreeze({
      seed: 42,
      arena: arenaB,
      rules: { maxTicks: 25, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defsB,
      units: [
        { instanceId: 'a1', definitionId: 'fighter', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 380, y: 400, angle: 0 } },
        { instanceId: 'd1', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 420, y: 400, angle: Math.PI } },
      ],
      catalog: { unitTypes: defsB },
      scheduledEffects: [],
    })

    const beforeA = JSON.stringify(battleA)
    const beforeB = JSON.stringify(battleB)

    // Sequence 1: A -> B -> A
    const resA1 = simulateCombat(battleA)
    const resB1 = simulateCombat(battleB)
    const resA2 = simulateCombat(battleA)

    expect(resA1).toEqual(resA2)
    expect(resA1).not.toEqual(resB1)
    expect(JSON.stringify(battleA)).toBe(beforeA)
    expect(JSON.stringify(battleB)).toBe(beforeB)

    // Sequence 2: B -> A -> B
    const resB2 = simulateCombat(battleB)
    const resA3 = simulateCombat(battleA)
    const resB3 = simulateCombat(battleB)

    expect(resB2).toEqual(resB1)
    expect(resB3).toEqual(resB1)
    expect(resA3).toEqual(resA1)

    expect(resA1.initialState[0].maxHp).toBe(120)
    expect(resA1.initialState[0].attack).toBe(15)
    expect(resB1.initialState[0].maxHp).toBe(600)
    expect(resB1.initialState[0].attack).toBe(40)
  })

  it('isolates intentionally colliding definition IDs across distinct catalogs without cross-contamination', () => {
    const defsMars: Record<string, UnitDefinition> = {
      marine: makeDef('marine', 'Mars Marine', 100, 12),
      dummy: makeDef('dummy', 'Target Dummy', 500, 0),
    }

    const defsFantasy: Record<string, UnitDefinition> = {
      marine: makeDef('marine', 'Fantasy Marine (Champion)', 777, 95),
      dummy: makeDef('dummy', 'Target Dummy', 500, 0),
    }

    const battleMars: BattleInput = deepFreeze({
      seed: 928,
      arena: makeArena(600, 600),
      rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defsMars,
      units: [
        { instanceId: 'm1', definitionId: 'marine', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 260, y: 300, angle: 0 } },
        { instanceId: 't1', definitionId: 'dummy', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 340, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defsMars },
      scheduledEffects: [],
    })

    const battleFantasy: BattleInput = deepFreeze({
      seed: 928,
      arena: makeArena(600, 600),
      rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defsFantasy,
      units: [
        { instanceId: 'm1', definitionId: 'marine', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 260, y: 300, angle: 0 } },
        { instanceId: 't1', definitionId: 'dummy', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 340, y: 300, angle: Math.PI } },
      ],
      catalog: { unitTypes: defsFantasy },
      scheduledEffects: [],
    })

    const resM1 = simulateCombat(battleMars)
    const resF1 = simulateCombat(battleFantasy)
    const resM2 = simulateCombat(battleMars)
    const resF2 = simulateCombat(battleFantasy)

    expect(resM1).toEqual(resM2)
    expect(resF1).toEqual(resF2)

    expect(resM1.initialState.find(u => u.type === 'marine')?.maxHp).toBe(100)
    expect(resF1.initialState.find(u => u.type === 'marine')?.maxHp).toBe(777)
    expect(resM1.logs).not.toEqual(resF1.logs)
  })

  it('executes interleaved ECS runtimes phase by phase without state leakage or shared resources', () => {
    const defsA: Record<string, UnitDefinition> = {
      hero: makeDef('hero', 'Hero A', 200, 20, {
        periodicAbilities: [{ id: 'healA', intervalTicks: 1, initialDelayTicks: 0, targetPolicy: 'self', payload: { kind: 'heal', amount: 20 } }],
      }),
    }
    const defsB: Record<string, UnitDefinition> = {
      hero: makeDef('hero', 'Hero B', 800, 80, {
        periodicAbilities: [{ id: 'healB', intervalTicks: 1, initialDelayTicks: 0, targetPolicy: 'self', payload: { kind: 'heal', amount: 50 } }],
      }),
    }

    const catalogA = toCatalog(defsA)
    const catalogB = toCatalog(defsB)

    const runtimeA = createEcsCombatRuntime({ catalog: catalogA })
    const runtimeB = createEcsCombatRuntime({ catalog: catalogB })

    const unitA = compileUnitSnapshot({
      definitionId: 'hero',
      identity: { id: 'h1', team: 'attacker' },
      loadout: { rank: 1, upgradeIds: [] },
      placement: { x: 100, y: 100, angle: 0 },
      overrides: { currentHp: 50 },
      catalog: catalogA,
    })!

    const unitB = compileUnitSnapshot({
      definitionId: 'hero',
      identity: { id: 'h1', team: 'attacker' },
      loadout: { rank: 1, upgradeIds: [] },
      placement: { x: 200, y: 200, angle: 0 },
      overrides: { currentHp: 100 },
      catalog: catalogB,
    })!

    runtimeA.world.queueUnitCreation(unitA)
    runtimeB.world.queueUnitCreation(unitB)

    runtimeA.world.flushStructuralCommands()
    runtimeB.world.flushStructuralCommands()

    const entityA = runtimeA.world.getEntityId('h1')!
    const entityB = runtimeB.world.getEntityId('h1')!

    expect(runtimeA.world.stores.vitality.require(entityA).hp).toBe(50)
    expect(runtimeB.world.stores.vitality.require(entityB).hp).toBe(100)

    const clockA = { tick: 0, dt: 1, maxTicks: 100, timeoutPolicy: 'draw' as const }
    const clockB = { tick: 0, dt: 1, maxTicks: 100, timeoutPolicy: 'draw' as const }
    runtimeA.world.resources.set('clock', clockA)
    runtimeB.world.resources.set('clock', clockB)

    const actionsA: import('../src/combat.types.js').BattleAction[] = []
    const actionsB: import('../src/combat.types.js').BattleAction[] = []
    runtimeA.world.resources.set('actions', actionsA)
    runtimeB.world.resources.set('actions', actionsB)

    // Run stage on runtime A; verify runtime A heals 50->70, actions recorded, and runtime B is untouched
    runtimeA.runStage('pre_action', { tick: 0, actions: actionsA, rng: new PRNG(1), activeGlobals: [] })
    expect(runtimeA.world.stores.vitality.require(entityA).hp).toBe(70)
    expect(actionsA.some(a => a.type === 'heal' && a.unitId === 'h1' && a.damage === 20)).toBe(true)
    expect(runtimeB.world.stores.vitality.require(entityB).hp).toBe(100)
    expect(actionsB).toHaveLength(0)

    clockA.tick = 1
    runtimeA.runStage('action', { tick: 1, actions: actionsA, rng: new PRNG(1), activeGlobals: [] })
    expect(runtimeB.world.stores.vitality.require(entityB).hp).toBe(100)

    // Run stage on runtime B; verify runtime B heals 100->150 and runtime A is untouched
    clockB.tick = 0
    runtimeB.runStage('pre_action', { tick: 0, actions: actionsB, rng: new PRNG(2), activeGlobals: [] })
    expect(runtimeB.world.stores.vitality.require(entityB).hp).toBe(150)
    expect(actionsB.some(a => a.type === 'heal' && a.unitId === 'h1' && a.damage === 50)).toBe(true)
    expect(runtimeA.world.stores.vitality.require(entityA).hp).toBe(70)

    // Verify distinct resources and isolation
    expect(runtimeA.world.resources.get('catalog')).toBe(catalogA)
    expect(runtimeB.world.resources.get('catalog')).toBe(catalogB)
    for (const key of ['combatTagCache', 'dirtySpatialEntities', 'temporalAttacks', 'statusDamageAttribution'] as const) {
      expect(runtimeA.world.resources.get(key)).not.toBe(runtimeB.world.resources.get(key))
    }
  })
})

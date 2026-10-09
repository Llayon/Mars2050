import { describe, expect, it } from 'vitest'
import { simulateCombat } from '../src/facade/combat-facade.js'
import { createEcsCombatRuntime } from '../src/ecs/combat-ecs-runtime.js'
import { compileUnitSnapshot } from '../src/combat.unit-compiler.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import type { CombatCatalog } from '../src/combat.catalog.types.js'

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj
  Object.freeze(obj)
  for (const value of Object.values(obj as Record<string, unknown>)) deepFreeze(value)
  return obj
}

function makeDef(id: string, extra: Record<string, unknown> = {}): UnitDefinition {
  return {
    id, name: id, squadSize: 1, squadSpacing: 20, formation: 'grid',
    baseStats: { hp: 1000, attack: 0, defense: 0, speed: 0, range: 150, attackType: 'single', actionCooldownMax: 10, turnSpeed: 5, size: 'S', combatTags: ['organic'], ...extra },
  }
}

function toCatalog(defs: Record<string, UnitDefinition>): CombatCatalog {
  return deepFreeze({ unitTypes: Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, mapDefinitionToUnitTypeConfig(v)])) })
}

describe('R5b / ISO-08: Lifecycle and nested runtime state isolation', () => {
  it('executes action spawn, periodic ability spawn, and damage trigger spawn strictly from local catalog', () => {
    const defs: Record<string, UnitDefinition> = {
      actionSpawner: makeDef('actionSpawner', {
        hp: 500,
        attackType: 'spawn',
        spawnType: 'minion',
        spawnCap: 1,
        actionCooldownMax: 2,
      }),
      periodicSpawner: makeDef('periodicSpawner', {
        hp: 500,
        periodicAbilities: [{
          id: 'summon-periodic',
          intervalTicks: 2,
          initialDelayTicks: 0,
          targetPolicy: 'self',
          payload: { kind: 'spawn', unitType: 'minion', cap: 1 },
        }],
      }),
      triggerSpawner: makeDef('triggerSpawner', {
        hp: 500,
        triggerEffects: [{
          id: 'summon-trigger',
          event: 'damage_taken',
          maxTriggers: 1,
          payload: { kind: 'spawn', target: 'self', unitType: 'minion', cap: 1 },
        }],
      }),
      minion: makeDef('minion', { hp: 45, attack: 8, speed: 60, range: 40 }),
      target: makeDef('target', { hp: 5000, attack: 10, range: 100, actionCooldownMax: 2 }),
      anchor: makeDef('anchor', { hp: 10000, range: 0 }),
    }

    const catalog = deepFreeze({ unitTypes: defs })

    // 1. Action spawn battle
    const actionBattle: BattleInput = deepFreeze({
      seed: 928,
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 8, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defs,
      units: [
        { instanceId: 'a', definitionId: 'actionSpawner', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 340, angle: 0 } },
        { instanceId: 'd', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 260, angle: Math.PI } },
        { instanceId: 'anchor', definitionId: 'anchor', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 50, y: 50, angle: 0 } },
      ],
      catalog,
      scheduledEffects: [],
    })
    const actionResult = simulateCombat(actionBattle)
    const actionSpawns = actionResult.logs.flatMap(t => t.actions).filter(a => a.type === 'spawn')
    expect(actionSpawns.length).toBeGreaterThan(0)
    expect(actionSpawns[0]).toMatchObject({ spawnType: 'minion', spawnTeam: 'attacker' })

    // 2. Periodic ability spawn battle
    const periodicBattle: BattleInput = deepFreeze({
      seed: 928,
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 8, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defs,
      units: [
        { instanceId: 'a', definitionId: 'periodicSpawner', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 340, angle: 0 } },
        { instanceId: 'd', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 260, angle: Math.PI } },
        { instanceId: 'anchor', definitionId: 'anchor', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 50, y: 50, angle: 0 } },
      ],
      catalog,
      scheduledEffects: [],
    })
    const periodicResult = simulateCombat(periodicBattle)
    const periodicSpawns = periodicResult.logs.flatMap(t => t.actions).filter(a => a.type === 'spawn')
    expect(periodicSpawns.length).toBeGreaterThan(0)
    expect(periodicSpawns[0]).toMatchObject({ spawnType: 'minion', spawnTeam: 'attacker' })

    // 3. Trigger spawn battle
    const triggerBattle: BattleInput = deepFreeze({
      seed: 928,
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 8, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: defs,
      units: [
        { instanceId: 'a', definitionId: 'triggerSpawner', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 340, angle: 0 } },
        { instanceId: 'd', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 260, angle: Math.PI } },
        { instanceId: 'anchor', definitionId: 'anchor', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 50, y: 50, angle: 0 } },
      ],
      catalog,
      scheduledEffects: [],
    })
    const triggerResult = simulateCombat(triggerBattle)
    const triggerSpawns = triggerResult.logs.flatMap(t => t.actions).filter(a => a.type === 'spawn')
    expect(triggerSpawns.length).toBeGreaterThan(0)
    expect(triggerSpawns[0]).toMatchObject({ spawnType: 'minion', spawnTeam: 'attacker' })
  })

  it('executes V8 sequential death-spawn as positive control (noting V9 open defect separately)', () => {
    const definitions: Record<string, UnitDefinition> = {
      owner: makeDef('owner', {
        hp: 40,
        triggerEffects: [{
          id: 'after-death',
          event: 'death',
          payload: { kind: 'spawn', target: 'self', unitType: 'minion', count: 1 },
        }],
      }),
      killer: makeDef('killer', { attack: 100, range: 100, actionCooldownMax: 2 }),
      minion: makeDef('minion', { hp: 90, attack: 10 }),
      anchor: makeDef('anchor', { hp: 5000, range: 0 }),
    }

    const catalog = deepFreeze({ unitTypes: definitions })
    const battleV8: BattleInput = deepFreeze({
      seed: 928,
      definitions,
      catalog,
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 8, timeoutPolicy: 'draw', defenseResolutionMode: 'v8_sequential' },
      units: [
        { instanceId: 'a', definitionId: 'owner', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 340, angle: -Math.PI / 2 } },
        { instanceId: 'd', definitionId: 'killer', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 260, angle: Math.PI / 2 } },
        { instanceId: 'anchor', definitionId: 'anchor', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 60, y: 540, angle: 0 } },
      ],
      scheduledEffects: [],
    })

    const result = simulateCombat(battleV8)
    const actions = result.logs.flatMap(t => t.actions)
    const deathEvents = actions.filter(a => a.type === 'die')
    const triggerEvents = actions.filter(a => a.type === 'trigger_effect')
    const spawnEvents = actions.filter(a => a.type === 'spawn')

    expect(deathEvents.length).toBeGreaterThan(0)
    expect(triggerEvents.length).toBeGreaterThan(0)
    expect(spawnEvents).toHaveLength(1)
    expect(spawnEvents[0]).toMatchObject({ spawnType: 'minion', spawnTeam: 'attacker' })
  })

  it('executes real reassembly lifecycle with independent entity schedules and restored HP', () => {
    const makeInput = (delayTicks: number, maxTicks: number): BattleInput => deepFreeze({
      seed: 928,
      definitions: {
        owner: makeDef('owner', { hp: 40 }),
        killer: makeDef('killer', { attack: 100, range: 100, actionCooldownMax: 20 }),
        anchor: makeDef('anchor', { hp: 5000, range: 0 }),
      },
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [] },
      rules: { maxTicks, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      units: [
        { instanceId: 'u', definitionId: 'owner', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 300, y: 340, angle: -Math.PI / 2 }, preparedStats: { reassembly: { delayTicks, hpPercent: 0.5, maxTriggers: 1 } } },
        { instanceId: 'k', definitionId: 'killer', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 260, angle: Math.PI / 2 } },
        { instanceId: 'anchor', definitionId: 'anchor', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 60, y: 540, angle: 0 } },
      ],
      scheduledEffects: [],
    })

    // Schedule 1: delayTicks = 2 -> completes at tick 3
    const resFast = simulateCombat(makeInput(2, 4))
    const fastActions = resFast.logs.flatMap(t => t.actions)
    expect(fastActions.some(a => a.type === 'reassembly_start' && a.unitId === 'u')).toBe(true)
    const fastComplete = fastActions.filter(a => a.type === 'reassembly_complete')
    expect(fastComplete).toHaveLength(1)
    expect(fastComplete[0]).toMatchObject({ unitId: 'u', targetId: 'u', damage: 20 })
    expect(resFast.survivors.find(u => u.id === 'u')?.hp).toBe(20)

    // Schedule 2: delayTicks = 4 -> at tick 4 still in countdown, completes at tick 5
    const resSlowAt4 = simulateCombat(makeInput(4, 4))
    expect(resSlowAt4.logs.flatMap(t => t.actions).filter(a => a.type === 'reassembly_complete')).toHaveLength(0)
    expect(resSlowAt4.survivors.find(u => u.id === 'u')).toBeUndefined()

    const resSlowAt6 = simulateCombat(makeInput(4, 6))
    const slowComplete = resSlowAt6.logs.flatMap(t => t.actions)
      .filter(a => a.type === 'reassembly_complete')
    expect(slowComplete).toHaveLength(1)
    expect(slowComplete[0]).toMatchObject({ unitId: 'u', targetId: 'u', damage: 20 })
    expect(resSlowAt6.survivors.find(u => u.id === 'u')?.hp).toBe(20)
  })

  it('detaches clone runtime state and strictly isolates component stores per entity and world', () => {
    const defs: Record<string, UnitDefinition> = {
      hero: makeDef('hero', {
        shieldHitBlock: { charges: 3 },
        formationModifiers: { adjacencyBonus: { radius: 50, maxStacks: 2, damageReductionPerAlly: 0.1 } },
      }),
    }
    const catalog = toCatalog(defs)
    const runtime1 = createEcsCombatRuntime({ catalog })
    const runtime2 = createEcsCombatRuntime({ catalog })

    runtime1.world.queueUnitCreation(
      compileUnitSnapshot({ definitionId: 'hero', identity: { id: 'a', team: 'attacker' }, loadout: { rank: 1, upgradeIds: [] }, placement: { x: 100, y: 100, angle: 0 }, catalog })!,
      compileUnitSnapshot({ definitionId: 'hero', identity: { id: 'b', team: 'attacker' }, loadout: { rank: 1, upgradeIds: [] }, placement: { x: 120, y: 100, angle: 0 }, catalog })!,
    )
    runtime2.world.queueUnitCreation(
      compileUnitSnapshot({ definitionId: 'hero', identity: { id: 'a', team: 'attacker' }, loadout: { rank: 1, upgradeIds: [] }, placement: { x: 100, y: 100, angle: 0 }, catalog })!,
    )
    runtime1.world.flushStructuralCommands()
    runtime2.world.flushStructuralCommands()

    const entityA = runtime1.world.getEntityId('a')!
    runtime1.world.queueUnitClone(entityA, 'cloneA', 150, 150)
    runtime1.world.flushStructuralCommands()
    const cloneA = runtime1.world.getEntityId('cloneA')!
    const beforeClone = structuredClone(runtime1.world.snapshotEntity(cloneA))

    const entityB = runtime1.world.getEntityId('b')!
    const beforeEntityB = structuredClone(runtime1.world.snapshotEntity(entityB))
    const beforeWorld2 = structuredClone(runtime2.world.snapshot())

    // Mutate entity A in world 1
    runtime1.world.stores.defense.require(entityA).shieldHitBlockCharges = 0
    runtime1.world.stores.vitality.require(entityA).hp = 1

    // Clone A, entity B, and entire world 2 must remain completely unaffected
    expect(runtime1.world.snapshotEntity(cloneA)).toEqual(beforeClone)
    expect(runtime1.world.snapshotEntity(entityB)).toEqual(beforeEntityB)
    expect(runtime2.world.snapshot()).toEqual(beforeWorld2)
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runEcsFormationBonusSystem } from '@/domains/combat/ecs/systems'

function unit(id: string, x: number): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS formation bonus phase', () => {
  it('matches legacy adjacency status application and refresh', () => {
    const source = unit('source', 100)
    source.formationModifiers = {
      adjacencyBonus: {
        radius: 100,
        maxStacks: 2,
        damageReductionPerAlly: 0.1,
        rangeBoostPerAlly: 0.2,
        attackBoostPerAlly: 0.3,
      },
    }
    const legacy = createLegacyCombatRuntime()
    const ecs = createEcsCombatRuntime()
    for (const candidate of [source, unit('near-a', 140), unit('near-b', 180)]) {
      legacy.units.push(structuredClone(candidate))
      ecs.units.push(structuredClone(candidate))
    }
    ecs.flushStructuralCommands()
    const legacyActions: BattleAction[] = []
    const ecsActions: BattleAction[] = []

    for (const tick of [9, 10, 20]) {
      legacy.runFormationBonusPhase(tick, legacyActions)
      ecs.runFormationBonusPhase(tick, ecsActions)
    }

    expect(ecsActions).toEqual(legacyActions)
    expect(ecs.snapshotUnits()).toEqual(legacy.snapshotUnits())
    expect(ecsActions.filter(action => action.type === 'adjacency_bonus'))
      .toHaveLength(2)
  })

  it('uses canonical components and local queries in external-ID order', () => {
    const world = new CombatWorld([
      unit('zeta', 100),
      unit('alpha', 140),
      unit('neighbor', 180),
      unit('far', 500),
    ])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    for (const entityId of [0, 1]) {
      world.stores.support.require(entityId).formationModifiers = {
        adjacencyBonus: {
          radius: 100,
          maxStacks: 2,
          attackBoostPerAlly: 0.25,
        },
      }
    }
    spatial.rebuild(world)
    const actions: BattleAction[] = []

    expect(world.roster.slice(0, 2)
      .every(candidate => !candidate.formationModifiers)).toBe(true)
    runEcsFormationBonusSystem(world, 10, actions)

    expect(actions.filter(action => action.type === 'adjacency_bonus')
      .map(action => action.unitId)).toEqual(['alpha', 'zeta'])
    expect(world.stores.statusControl.require(0).statusEffects)
      .toContainEqual(expect.objectContaining({
        type: 'attack_boost',
        value: 0.5,
      }))
    expect(spatial.getProfile().queryCount).toBe(2)
  })

  it('does not overwrite canonical formation inputs from facades', () => {
    const source = unit('canonical-source', 100)
    source.formationModifiers = {
      adjacencyBonus: {
        radius: 100,
        maxStacks: 2,
        attackBoostPerAlly: 0.25,
      },
    }
    const neighbor = unit('canonical-neighbor', 140)
    const runtime = createEcsCombatRuntime()
    runtime.units.push(source, neighbor)
    runtime.flushStructuralCommands()
    source.formationModifiers = undefined
    source.x = 800
    neighbor.x = 950
    const actions: BattleAction[] = []

    runtime.runFormationBonusPhase(10, actions)

    const sourceId = runtime.world.getEntityId(source.id)!
    expect(actions).toContainEqual({
      unitId: 'canonical-source',
      type: 'adjacency_bonus',
      value: 1,
    })
    expect(runtime.world.stores.statusControl.require(sourceId).statusEffects)
      .toContainEqual(expect.objectContaining({
        type: 'attack_boost',
        value: 0.25,
      }))
    expect(runtime.units[0].statusEffects)
      .toContainEqual(expect.objectContaining({ type: 'attack_boost' }))
  })
})

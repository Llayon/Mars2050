import { describe, expect, it } from 'vitest'
import { PendingImpactQueue } from '@/domains/combat/ecs/pending-impacts'
import { allocateTemporalInterceptions } from '@/domains/combat/ecs/systems/damage-interception-system'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import type { UnitRow } from '@/domains/combat/combat.types'

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

describe('combat ECS v8 temporal delivery', () => {
  it('keeps impacts ordered by stable id inside the same tick', () => {
    const queue = new PendingImpactQueue()
    const base = {
      sourceId: 1, sourceExternalId: 'a', sourceTeam: 'attacker' as const,
      targetX: 10, targetY: 10, launchTick: 2, impactTick: 5,
      kind: 'projectile' as const, payload: { kind: 'direct' as const, damage: 10 },
      interceptable: true,
    }
    const first = queue.enqueue(base)
    const second = queue.enqueue({ ...base, sourceExternalId: 'b' })
    expect(queue.take(5).map(impact => impact.id)).toEqual([first.id, second.id])
    expect(queue.hasDamagePending()).toBe(false)
  })

  it('does not expose future impacts before their tick', () => {
    const queue = new PendingImpactQueue()
    queue.enqueue({
      sourceId: 1, sourceExternalId: 'a', sourceTeam: 'attacker', targetX: 0, targetY: 0,
      launchTick: 1, impactTick: 4, kind: 'ground_targeted',
      payload: { kind: 'area' as const, damage: 4, radius: 30 }, interceptable: true,
    })
    expect(queue.take(3)).toEqual([])
    expect(queue.hasDamagePending()).toBe(true)
  })

  it('allocates one interceptor by raw damage priority with stable ties', () => {
    const makeUnit = (id: string, team: 'attacker' | 'defender', x: number): SimUnit => createRuntimeUnitFromConfig({ id, team, type: team === 'attacker' ? 'missile_buggy' : 'shield_emitter', x, y: 100, currentAngle: 0 })!
    const interceptor = makeUnit('interceptor', 'defender', 120)
    interceptor.projectileInterceptRadius = 200
    interceptor.projectileInterceptCooldown = 0
    interceptor.projectileInterceptCooldownMax = 3
    const world = new CombatWorld([makeUnit('source', 'attacker', 10), interceptor])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)
    const points = [
      { impact: { id: 2, sourceId: 0, sourceExternalId: 'source', sourceTeam: 'attacker' as const, targetTeam: 'defender' as const, targetX: 120, targetY: 100, launchTick: 0, impactTick: 1, kind: 'projectile' as const, positionPolicy: 'captured_at_launch' as const, payload: { kind: 'direct' as const, damage: 20, targetId: 1 }, interceptionDamage: 20, interceptable: true }, x: 120, y: 100 },
      { impact: { id: 1, sourceId: 0, sourceExternalId: 'source', sourceTeam: 'attacker' as const, targetTeam: 'defender' as const, targetX: 120, targetY: 100, launchTick: 0, impactTick: 1, kind: 'projectile' as const, positionPolicy: 'captured_at_launch' as const, payload: { kind: 'direct' as const, damage: 90, targetId: 1 }, interceptionDamage: 90, interceptable: true }, x: 120, y: 100 },
    ]
    const allocation = allocateTemporalInterceptions(world, points)
    expect([...allocation.byImpact.entries()]).toEqual([[1, 1]])
    expect(allocation.cooldownEntities).toEqual([1])
  })

  it('runs artillery through the temporal scheduler as four independent shells', () => {
    const preset = getSimulatorPreset('projectile_barrier')!
    const result = simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), 24680, [])
    const artilleryActions = result.logs.flatMap(tick => tick.actions)
      .filter(action => action.unitId === 'pb-a-artillery')
    const launches = artilleryActions.filter(action => action.type === 'projectile_launch')
    const firstLaunchTick = launches[0]?.launchTick
    const firstVolley = launches.filter(action => action.launchTick === firstLaunchTick)
    expect(firstVolley).toHaveLength(4)
    expect(firstVolley.map(action => action.impactTick)).toEqual([27, 28, 29, 30])
    expect(firstVolley.every(action => action.projectileKind === 'ground_targeted')).toBe(true)
    expect(firstVolley.every(action => action.toX !== undefined && action.toY !== undefined)).toBe(true)
    expect(artilleryActions.some(action => action.type === 'attack_windup')).toBe(true)
    expect(artilleryActions.some(action => action.type === 'barrage_impact')).toBe(false)
    expect(artilleryActions.filter(action => action.type === 'projectile_impact')
      .every(action => action.targetId === undefined)).toBe(true)
  })
})

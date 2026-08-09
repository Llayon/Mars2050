import { describe, expect, it } from 'vitest'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { getDistance, getSizeRadius, PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getEcsPositioningDecision, type EcsPositioningDecision } from '@/domains/combat/ecs/movement-positioning'
import { createEcsMeleeEngagementState, reserveEcsMeleeSlot } from '@/domains/combat/ecs/systems'
import { runMovementSystem } from '@/domains/combat/ecs/systems/movement-system'

type DefenseResolutionMode = 'v8_sequential' | 'v9_snapshot'
type Point = { x: number; y: number }

describe('V9 melee waiting placement', () => {
  it.each([
    ['source', 'source-renamed', 'target'],
    ['source', 'source', 'target-renamed'],
    ['source', 'source-renamed', 'target-renamed'],
    ['source', 'unrelated-α', 'unrelated-ω'],
  ])('keeps the full decision invariant for %s ID changes', (_name, sourceId, targetId) => {
    expect(waitingDecision(sourceId, targetId)).toEqual(waitingDecision('source', 'target'))
  })

  it('keeps the decision invariant when ECS creation order is reversed', () => {
    expect(waitingDecision('source', 'target', true, true)).toEqual(waitingDecision('source', 'target'))
  })

  it('uses physical bearing as a meaningful V9 input', () => {
    const west = waitingDecision('source', 'target', true, false, { x: 100, y: 300 }, { x: 300, y: 300 })
    const northwest = waitingDecision('source', 'target', true, false, { x: 100, y: 200 }, { x: 300, y: 300 })
    expect(northwest.point).not.toEqual(west.point)
  })

  it('keeps the same destination along one radial line and changes continuously laterally', () => {
    const target = { x: 400, y: 300 }
    const radial = [100, 180, 260].map(x => waitingDecision(`source-${x}`, 'target', true, false, { x, y: 300 }, target).point)
    expect(radial[1]).toEqual(radial[0])
    expect(radial[2]).toEqual(radial[0])
    expect(waitingDecision('source-lateral', 'target', true, false, { x: 100, y: 320 }, target).point).not.toEqual(radial[0])
  })

  it('uses a finite physical fallback at zero distance', () => {
    const currentAngle = waitingDecision('source', 'target', true, false, { x: 300, y: 300 }, { x: 300, y: 300 }, Math.PI / 2)
    const renamed = waitingDecision('renamed-source', 'renamed-target', true, false, { x: 300, y: 300 }, { x: 300, y: 300 }, Math.PI / 2)
    expect(currentAngle).toEqual(renamed)
    expect(Number.isFinite(currentAngle.point.x)).toBe(true)
    expect(Number.isFinite(currentAngle.point.y)).toBe(true)
    expect(currentAngle.point).not.toEqual({ x: 300, y: 300 })
  })

  it('falls back from invalid currentAngle to initialAngle and then angle zero', () => {
    const initial = waitingDecision('source', 'target', true, false, { x: 300, y: 300 }, { x: 300, y: 300 }, Number.NaN, Math.PI / 2)
    const zero = waitingDecision('source', 'target', true, false, { x: 300, y: 300 }, { x: 300, y: 300 }, Number.NaN, Number.NaN)
    expect(initial.point.x).toBeCloseTo(300)
    expect(initial.point.y).toBeGreaterThan(300)
    expect(zero.point.x).toBeGreaterThan(300)
    expect(zero.point.y).toBeCloseTo(300)
  })

  it('keeps the non-waiting branch ID-independent', () => {
    expect(waitingDecision('source', 'target', false)).toEqual(waitingDecision('renamed-source', 'renamed-target', false))
  })

  it('retains raw-ID sensitivity only in the V8 compatibility path', () => {
    const baseline = waitingDecision('source', 'target', true, false, undefined, undefined, 0, undefined, 'v8_sequential')
    const renamed = waitingDecision('renamed-source', 'renamed-target', true, false, undefined, undefined, 0, undefined, 'v8_sequential')
    expect(renamed.point).not.toEqual(baseline.point)
  })

  it('keeps saturated waiters deterministic, distinct by bearing, and moving', () => {
    const baseline = buildSaturationWorld('base-', false)
    const renamed = buildSaturationWorld('renamed-', false)
    const reversed = buildSaturationWorld('base-', true)

    expect(baseline.engagedCount).toBeGreaterThanOrEqual(4)
    expect(baseline.waiterDecisions).toHaveLength(6)
    expect(baseline.waiterDecisions).toEqual(renamed.waiterDecisions)
    expect(baseline.waiterDecisions).toEqual(reversed.waiterDecisions)
    expect(new Set(baseline.waiterDecisions.map(item => `${item.point.x}:${item.point.y}`)).size).toBeGreaterThan(1)
    expect(baseline.progress.distinctFinalPositions).toBeGreaterThan(1)
    expect(baseline.progress.radialErrorReduced).toBe(true)
    expect(baseline.progress.alternatesTwoPositions).toBe(false)
  }, 30_000)
})

function waitingDecision(
  sourceId: string,
  targetId: string,
  waiting = true,
  reverseCreation = false,
  sourcePoint: Point = { x: 100, y: 100 },
  targetPoint: Point = { x: 300, y: 300 },
  currentAngle = 0,
  initialAngle?: number,
  defenseResolutionMode: DefenseResolutionMode = 'v9_snapshot',
): EcsPositioningDecision {
  const source = createRuntimeUnitFromConfig({ id: sourceId, team: 'attacker', type: 'shock_trooper', ...sourcePoint, currentAngle })
  const target = createRuntimeUnitFromConfig({ id: targetId, team: 'defender', type: 'light_walker', ...targetPoint, currentAngle: Math.PI })
  if (!source || !target) throw new Error('Expected waiting-position fixture units')
  const world = new CombatWorld(reverseCreation ? [target, source] : [source, target])
  world.resources.set('defenseResolutionMode', defenseResolutionMode)
  const sourceEntity = world.getEntityId(sourceId)
  const targetEntity = world.getEntityId(targetId)
  if (sourceEntity === undefined || targetEntity === undefined) throw new Error('Expected waiting-position fixture entities')
  if (initialAngle !== undefined) world.stores.transform.require(sourceEntity).initialAngle = initialAngle
  if (waiting) world.stores.entityTargets.require(sourceEntity).meleeWaitingTarget = targetEntity
  const sourceTransform = world.stores.transform.require(sourceEntity)
  const targetTransform = world.stores.transform.require(targetEntity)
  const distEdge = getDistance(sourceTransform.x, sourceTransform.y, targetTransform.x, targetTransform.y) - getSizeRadius(targetTransform.size) - getSizeRadius(sourceTransform.size)
  return getEcsPositioningDecision(world, sourceEntity, targetEntity, distEdge, getSizeRadius(targetTransform.size), getSizeRadius(sourceTransform.size))
}

function buildSaturationWorld(prefix: string, reverseCreation: boolean): {
  waiterDecisions: { semantic: string; point: Point; shouldMove: boolean; combatInRange: boolean }[]
  engagedCount: number
  progress: { distinctFinalPositions: number; radialErrorReduced: boolean; alternatesTwoPositions: boolean }
} {
  const target = createRuntimeUnitFromConfig({ id: `${prefix}target`, team: 'defender', type: 'light_walker', x: 500, y: 400, currentAngle: Math.PI })!
  const units = Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2
    return createRuntimeUnitFromConfig({
      id: `${prefix}waiter-${index}`,
      team: 'attacker',
      type: 'shock_trooper',
      x: 500 + Math.cos(angle) * 160,
      y: 400 + Math.sin(angle) * 160,
      currentAngle: angle,
    })!
  })
  const allUnits = reverseCreation ? [target, ...[...units].reverse()] : [target, ...units]
  const world = new CombatWorld(allUnits)
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  const targetEntity = world.getEntityId(target.id)!
  const melee = createEcsMeleeEngagementState()
  let engagedCount = 0
  const waitingEntities: { semantic: string; entityId: number }[] = []
  for (const unit of units) {
    const entityId = world.getEntityId(unit.id)!
    if (reserveEcsMeleeSlot(world, entityId, targetEntity, melee)) engagedCount++
    else if (waitingEntities.length < 6) {
      world.stores.entityTargets.require(entityId).meleeWaitingTarget = targetEntity
      waitingEntities.push({ semantic: unit.id.replace(prefix, ''), entityId })
    }
  }
  if (waitingEntities.length !== 6) throw new Error(`Expected six waiting units, got ${waitingEntities.length}`)
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  const targetTransform = world.stores.transform.require(targetEntity)
  const waiterDecisions = waitingEntities.map(waiter => {
    const transform = world.stores.transform.require(waiter.entityId)
    const distEdge = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) - getSizeRadius(targetTransform.size) - getSizeRadius(transform.size)
    const decision = getEcsPositioningDecision(world, waiter.entityId, targetEntity, distEdge, getSizeRadius(targetTransform.size), getSizeRadius(transform.size))
    return { semantic: waiter.semantic, ...decision }
  }).sort((left, right) => left.semantic.localeCompare(right.semantic))
  const progress = runSaturationMovement(world, targetEntity, waitingEntities.map(item => item.entityId))
  return { waiterDecisions, engagedCount, progress }
}

function runSaturationMovement(world: CombatWorld, targetEntity: number, waiters: readonly number[]): { distinctFinalPositions: number; radialErrorReduced: boolean; alternatesTwoPositions: boolean } {
  const initialErrors = new Map(waiters.map(entityId => [entityId, radialError(world, entityId, targetEntity)]))
  const histories = new Map(waiters.map(entityId => [entityId, [] as string[]]))
  const context = { dt: 0.1, rng: new PRNG(9), flowField: createPathfindingMap([]), obstacles: [] }
  for (let tick = 0; tick < 12; tick++) {
    for (const entityId of waiters) {
      runMovementSystem(world, entityId, targetEntity, [], context)
      const transform = world.stores.transform.require(entityId)
      histories.get(entityId)!.push(`${transform.x}:${transform.y}`)
    }
  }
  const finalPositions = waiters.map(entityId => {
    const transform = world.stores.transform.require(entityId)
    return `${transform.x}:${transform.y}`
  })
  const radialErrorReduced = waiters.some(entityId => radialError(world, entityId, targetEntity) < (initialErrors.get(entityId) ?? Number.POSITIVE_INFINITY))
  const alternatesTwoPositions = waiters.some(entityId => {
    const history = histories.get(entityId)!.slice(-6)
    const values = [...new Set(history)]
    return values.length === 2 && history.every((value, index) => value === values[index % 2])
  })
  return { distinctFinalPositions: new Set(finalPositions).size, radialErrorReduced, alternatesTwoPositions }
}

function radialError(world: CombatWorld, entityId: number, targetEntity: number): number {
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetEntity)
  const radius = getSizeRadius(transform.size) + getSizeRadius(target.size) + Math.max(36, world.stores.combat.require(entityId).range * 1.35)
  return Math.abs(getDistance(transform.x, transform.y, target.x, target.y) - radius)
}

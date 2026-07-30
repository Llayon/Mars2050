import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { buildMovementCollisionPairs } from '@/domains/combat/ecs/movement-collision-pairs'
import { createMovementFrame } from '@/domains/combat/ecs/movement-frame'
import { buildMovementNeighborGraph } from '@/domains/combat/ecs/movement-neighbor-graph'
import {
  buildPackedMovementCells,
  getPackedMovementCell,
} from '@/domains/combat/ecs/movement-packed-cells'
import { ECS_MOVEMENT_MAX_NEIGHBORS } from '@/domains/combat/ecs/movement-steering'

function createMarine(id: string, x: number, team: 'attacker' | 'defender' = 'attacker') {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 100,
    currentAngle: 0,
  })!
}

describe('combat ECS batch movement', () => {
  it('packs cells without changing entity or occupied-cell insertion order', () => {
    const entityIds = [4, 1, 3, 2]
    const x = [0, 5, 8, 85, 80]
    const y = [0, 10, 10, 10, 10]
    const cells = buildPackedMovementCells(entityIds, x, y)
    const lowCell = getPackedMovementCell(5, 10)
    const highCell = getPackedMovementCell(80, 10)

    expect([...cells.occupiedCells.slice(0, cells.occupiedCount)])
      .toEqual([highCell, lowCell])
    expect([...cells.entityIds.slice(cells.offsets[lowCell], cells.offsets[lowCell + 1])])
      .toEqual([1, 2])
    expect([...cells.entityIds.slice(cells.offsets[highCell], cells.offsets[highCell + 1])])
      .toEqual([4, 3])
  })

  it('matches brute-force collision pairs for full and dirty traversals', () => {
    const entityIds = [0, 1, 2, 3, 4, 5]
    const x = [0, 20, 70, 100, 130, 250]
    const y = [100, 100, 100, 100, 100, 100]
    const radius = 60
    const bruteForce = entityIds.flatMap((firstId, firstIndex) =>
      entityIds.slice(firstIndex + 1).flatMap(secondId =>
        Math.hypot(x[secondId] - x[firstId], y[secondId] - y[firstId]) <= radius
          ? [[firstId, secondId] as [number, number]]
          : []))
    const dirty = new Set([1, 4])

    expect(buildMovementCollisionPairs(
      entityIds, x, y, new Set(entityIds), radius,
    )).toEqual(bruteForce)
    expect(buildMovementCollisionPairs(entityIds, x, y, dirty, radius))
      .toEqual(bruteForce.filter(([firstId, secondId]) =>
        dirty.has(firstId) || dirty.has(secondId)))
  })

  it('matches a brute-force nearest-neighbor oracle with a deterministic cap', () => {
    const attackers = Array.from(
      { length: 40 },
      (_, index) => createMarine(`attacker_${index}`, 100 + index * 4),
    )
    const world = new CombatWorld([
      ...attackers,
      createMarine('nearby_enemy', 102, 'defender'),
    ])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)

    const frame = createMovementFrame(world)
    const first = buildMovementNeighborGraph(world, frame)
    const second = buildMovementNeighborGraph(world, frame)
    const expected = frame.entityIds
      .filter(entityId => entityId !== 0)
      .filter(entityId => world.stores.identity.require(entityId).team === 'attacker')
      .map(entityId => ({
        entityId,
        distanceSquared: (frame.transforms[entityId]!.x - frame.transforms[0]!.x) ** 2,
      }))
      .sort((left, right) =>
        left.distanceSquared - right.distanceSquared || left.entityId - right.entityId)
      .slice(0, ECS_MOVEMENT_MAX_NEIGHBORS)
      .map(entry => entry.entityId)
      .sort((left, right) => left - right)

    expect([...first.neighbors.get(0)]).toEqual(expected)
    expect(first.neighbors.get(0)).toHaveLength(ECS_MOVEMENT_MAX_NEIGHBORS)
    expect(first.neighbors).toEqual(second.neighbors)
  })
})

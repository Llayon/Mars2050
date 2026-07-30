import { TILE_SIZE } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import {
  ECS_MOVEMENT_DENSE_NEIGHBOR_RADIUS,
  ECS_MOVEMENT_DENSE_TEAM_THRESHOLD,
  ECS_MOVEMENT_MAX_NEIGHBORS,
  ECS_MOVEMENT_NEIGHBOR_RADIUS,
} from './movement-steering'
import {
  buildPackedMovementCells,
  getPackedMovementCellByCoordinates,
  getPackedMovementCellCoordinates,
} from './movement-packed-cells'
import type { MovementFrame, MovementNeighborGraph } from './movement-batch.types'
import { MovementNeighborTable } from './movement-neighbor-table'

export function buildMovementNeighborGraph(
  world: CombatWorld,
  frame: MovementFrame,
): MovementNeighborGraph {
  const cells = buildPackedMovementCells(frame.entityIds, frame.x, frame.y)
  const neighbors = new MovementNeighborTable(
    frame.x.length,
    ECS_MOVEMENT_MAX_NEIGHBORS,
  )
  const teamRadius = {
    attacker: getTeamRadius(world, 'attacker'),
    defender: getTeamRadius(world, 'defender'),
  }
  const maxRadius = Math.max(teamRadius.attacker, teamRadius.defender)
  const reach = Math.ceil(maxRadius / TILE_SIZE)
  let candidatePairCount = 0
  let edgeCount = 0

  for (let occupied = 0; occupied < cells.occupiedCount; occupied++) {
    const firstCell = cells.occupiedCells[occupied]
    visitBucketPair(firstCell, firstCell, true)
    const { cellX, cellY } = getPackedMovementCellCoordinates(firstCell)
    for (let offsetX = -reach; offsetX <= reach; offsetX++) {
      for (let offsetY = -reach; offsetY <= reach; offsetY++) {
        const secondCell = getPackedMovementCellByCoordinates(
          cellX + offsetX,
          cellY + offsetY,
        )
        if (secondCell <= firstCell ||
            cells.offsets[secondCell] === cells.offsets[secondCell + 1]) continue
        visitBucketPair(firstCell, secondCell, false)
      }
    }
  }
  neighbors.finalize(frame.entityIds)

  return {
    frame,
    neighbors,
    candidatePairCount,
    edgeCount,
  }

  function visitBucketPair(
    firstCell: number,
    secondCell: number,
    sameBucket: boolean,
  ): void {
    const firstStart = cells.offsets[firstCell]
    const firstEnd = cells.offsets[firstCell + 1]
    const secondStart = cells.offsets[secondCell]
    const secondEnd = cells.offsets[secondCell + 1]
    for (let left = firstStart; left < firstEnd; left++) {
      const rightStart = sameBucket ? left + 1 : secondStart
      const firstId = cells.entityIds[left]
      for (let right = rightStart; right < secondEnd; right++) {
        const secondId = cells.entityIds[right]
        candidatePairCount++
        const firstIdentity = world.stores.identity.get(firstId)!
        const secondIdentity = world.stores.identity.get(secondId)!
        if (firstIdentity.team !== secondIdentity.team) continue
        const dx = frame.x[secondId] - frame.x[firstId]
        const dy = frame.y[secondId] - frame.y[firstId]
        const distanceSquared = dx * dx + dy * dy
        const radius = teamRadius[firstIdentity.team]
        if (distanceSquared > radius * radius) continue
        neighbors.add(firstId, secondId, distanceSquared)
        neighbors.add(secondId, firstId, distanceSquared)
        edgeCount++
      }
    }
  }
}

function getTeamRadius(world: CombatWorld, team: 'attacker' | 'defender'): number {
  return world.resources.require('entitySpatial').getTeamEntityCount(team) >
    ECS_MOVEMENT_DENSE_TEAM_THRESHOLD
    ? ECS_MOVEMENT_DENSE_NEIGHBOR_RADIUS
    : ECS_MOVEMENT_NEIGHBOR_RADIUS
}

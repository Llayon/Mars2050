import type { Team } from '../combat.sim.types'
import type { UnitTransformComponent } from '../combat.unit-core-components'
import type { EntityId } from './entity'

export interface FrozenMovementTransform {
  x: number
  y: number
  velocityX: number
  velocityY: number
  currentAngle: number
  initialAngle?: number
  offsetX?: number
  offsetY?: number
  size: UnitTransformComponent['size']
  isFlying: boolean
}

export interface MovementFrame {
  entityIds: readonly EntityId[]
  transforms: readonly (FrozenMovementTransform | undefined)[]
  x: Float64Array
  y: Float64Array
}

export type MovementRequest =
  | { kind: 'move'; entityId: EntityId; targetId: EntityId; initiativeIndex: number }
  | { kind: 'turn'; entityId: EntityId; targetX: number; targetY: number; initiativeIndex: number }

export interface MovementNeighborLookup {
  get(entityId: EntityId): Int32Array
}

export interface MovementNeighborGraph {
  frame: MovementFrame
  neighbors: MovementNeighborLookup
  candidatePairCount: number
  edgeCount: number
}

export interface MovementIntent {
  entityId: EntityId
  targetId?: EntityId
  requestKind: MovementRequest['kind']
  initiativeIndex: number
  team: Team
  fromX: number
  fromY: number
  toX: number
  toY: number
  velocityX: number
  velocityY: number
  facingAngle: number
  angleDifference: number
  isWalking: boolean
  motionKind: 'locomotion' | 'steering' | 'turn'
}

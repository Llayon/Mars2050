import type { RuntimeMovementContext } from '../../combat.runtime'
import type { CombatWorld } from '../combat-world'
import type { MovementIntent, MovementRequest } from '../movement-batch.types'
import { normalizeMovementAngle } from '../movement-batch-math'

export function createTurnIntent(
  world: CombatWorld,
  request: Extract<MovementRequest, { kind: 'turn' }>,
  frozen: { x: number; y: number; currentAngle: number },
  context: RuntimeMovementContext,
): MovementIntent {
  const angleDifference = normalizeMovementAngle(
    Math.atan2(request.targetY - frozen.y, request.targetX - frozen.x) - frozen.currentAngle,
  )
  const maxTurn = world.stores.movement.require(request.entityId).turnSpeed * context.dt
  const currentAngle = normalizeMovementAngle(
    Math.abs(angleDifference) <= maxTurn
      ? frozen.currentAngle + angleDifference
      : frozen.currentAngle + Math.sign(angleDifference) * maxTurn,
  )
  return {
    entityId: request.entityId,
    targetId: undefined,
    requestKind: 'turn',
    initiativeIndex: request.initiativeIndex,
    team: world.stores.identity.require(request.entityId).team,
    fromX: frozen.x,
    fromY: frozen.y,
    toX: frozen.x,
    toY: frozen.y,
    velocityX: 0,
    velocityY: 0,
    facingAngle: currentAngle,
    angleDifference,
    isWalking: false,
    motionKind: 'turn',
  }
}

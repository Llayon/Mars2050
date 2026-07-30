import type { CombatWorld } from './combat-world'
import type { MovementFrame } from './movement-batch.types'

export function createMovementFrame(world: CombatWorld): MovementFrame {
  const entityIds = world.query(['identity', 'transform', 'vitality', 'combat', 'movement'])
  const capacity = (entityIds[entityIds.length - 1] ?? -1) + 1
  const transforms: MovementFrame['transforms'][number][] = []
  const x = new Float64Array(capacity)
  const y = new Float64Array(capacity)
  for (const entityId of entityIds) {
    const transform = world.stores.transform.get(entityId)!
    x[entityId] = transform.x
    y[entityId] = transform.y
    transforms[entityId] = {
      x: transform.x,
      y: transform.y,
      velocityX: transform.velocity.x,
      velocityY: transform.velocity.y,
      currentAngle: transform.currentAngle,
      initialAngle: transform.initialAngle,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      size: transform.size,
      isFlying: transform.isFlying,
    }
  }
  return { entityIds, transforms, x, y }
}

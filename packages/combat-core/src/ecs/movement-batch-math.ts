export function blendMovementVelocity(
  velocity: { x: number; y: number },
  vx: number,
  vy: number,
  dt: number,
  maxSpeed: number,
): void {
  const blend = Math.min(1, dt * 8)
  velocity.x += (vx - velocity.x) * blend
  velocity.y += (vy - velocity.y) * blend
  clampMovementVelocity(velocity, maxSpeed)
}

export function clampMovementVelocity(
  velocity: { x: number; y: number },
  maxSpeed: number,
): void {
  const magnitude = Math.hypot(velocity.x, velocity.y)
  if (magnitude < 0.5) {
    velocity.x = 0
    velocity.y = 0
  } else if (magnitude > maxSpeed) {
    velocity.x = (velocity.x / magnitude) * maxSpeed
    velocity.y = (velocity.y / magnitude) * maxSpeed
  }
}

export function normalizeMovementAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

export function clampMovementValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

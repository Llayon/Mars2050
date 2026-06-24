import { describe, expect, it } from 'vitest'
import { getSteeringContext } from '@/domains/combat/combat.steering'
import { getSizeRadius } from '@/domains/combat/combat.utils'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    isDead: false,
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides
  }
}

describe('combat steering', () => {
  it('pushes fully overlapped units in opposite deterministic directions', () => {
    const first = makeUnit({ id: 'first', team: 'attacker', x: 100, y: 100 })
    const second = makeUnit({ id: 'second', team: 'attacker', x: 100, y: 100 })
    const radius = getSizeRadius(first.size)

    const firstContext = getSteeringContext(first, [first, second], radius, false)
    const secondContext = getSteeringContext(second, [first, second], radius, false)

    expect(Math.hypot(firstContext.separationX, firstContext.separationY)).toBeGreaterThan(0)
    expect(Math.hypot(secondContext.separationX, secondContext.separationY)).toBeGreaterThan(0)
    expect(firstContext.separationX + secondContext.separationX).toBeCloseTo(0, 5)
    expect(firstContext.separationY + secondContext.separationY).toBeCloseTo(0, 5)
  })
})

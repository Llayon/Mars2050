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

  it('does not use enemies as physical separation sources', () => {
    const defender = makeUnit({ id: 'defender', team: 'defender', x: 100, y: 100 })
    const melee = makeUnit({ id: 'melee', team: 'attacker', x: 125, y: 100, range: 40 })
    const radius = getSizeRadius(defender.size)

    const movingContext = getSteeringContext(defender, [defender, melee], radius, false)
    const combatContext = getSteeringContext(defender, [defender, melee], radius, true)

    expect(movingContext.separationX).toBe(0)
    expect(movingContext.separationY).toBe(0)
    expect(combatContext.separationX).toBe(0)
    expect(combatContext.separationY).toBe(0)
  })

  it('does not apply physical separation between flying units', () => {
    const first = makeUnit({ id: 'first', team: 'attacker', x: 100, y: 100, isFlying: true })
    const second = makeUnit({ id: 'second', team: 'attacker', x: 100, y: 100, isFlying: true })
    const context = getSteeringContext(first, [first, second], getSizeRadius(first.size), false)

    expect(context.separationX).toBe(0)
    expect(context.separationY).toBe(0)
  })

  it('pushes light units away from heavy units more than heavy units away from light units', () => {
    const light = makeUnit({ id: 'light', team: 'attacker', x: 100, y: 100, size: 'S' })
    const heavy = makeUnit({ id: 'heavy', team: 'attacker', x: 105, y: 100, size: 'XL' })

    const lightContext = getSteeringContext(light, [light, heavy], getSizeRadius(light.size), false)
    const heavyContext = getSteeringContext(heavy, [light, heavy], getSizeRadius(heavy.size), false)

    expect(Math.hypot(lightContext.separationX, lightContext.separationY)).toBeGreaterThan(
      Math.hypot(heavyContext.separationX, heavyContext.separationY) * 4
    )
  })

  it('keeps in-range allied separation weaker than moving separation', () => {
    const first = makeUnit({ id: 'first', team: 'attacker', x: 100, y: 100 })
    const second = makeUnit({ id: 'second', team: 'attacker', x: 105, y: 100 })
    const radius = getSizeRadius(first.size)

    const movingContext = getSteeringContext(first, [first, second], radius, false)
    const combatContext = getSteeringContext(first, [first, second], radius, true)
    const movingForce = Math.hypot(movingContext.separationX, movingContext.separationY)
    const combatForce = Math.hypot(combatContext.separationX, combatContext.separationY)

    expect(combatForce).toBeGreaterThan(0)
    expect(combatForce).toBeLessThan(movingForce)
  })
})

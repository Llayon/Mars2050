import { describe, expect, it } from 'vitest'
import { getFormationCohesionForce } from '@/domains/combat/combat.formation'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 100,
    range: 40,
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
    ...overrides,
  }
}

describe('combat formation cohesion', () => {
  it('weakens strict human formation pull near engagement', () => {
    const unit = makeUnit({
      id: 'marine',
      team: 'attacker',
      x: 0,
      y: 0,
      squadId: 'squad',
      offsetX: 100,
      offsetY: 0,
      initialAngle: 0,
    })

    const far = getFormationCohesionForce(unit, { x: 100, y: 0 }, 0, 0, 2, 220, false)
    const near = getFormationCohesionForce(unit, { x: 100, y: 0 }, 0, 0, 2, 20, false)

    expect(Math.hypot(near.x, near.y)).toBeLessThan(Math.hypot(far.x, far.y) * 0.3)
  })

  it('does not pull humans back to formation inside the relaxed engagement threshold', () => {
    const unit = makeUnit({
      id: 'marine',
      team: 'attacker',
      x: 0,
      y: 0,
      squadId: 'squad',
      offsetX: 24,
      offsetY: 0,
      initialAngle: 0,
    })

    const force = getFormationCohesionForce(unit, { x: 100, y: 0 }, 0, 0, 2, 20, false)

    expect(force).toEqual({ x: 0, y: 0 })
  })
})

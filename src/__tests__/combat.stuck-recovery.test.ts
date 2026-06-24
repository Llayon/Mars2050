import { describe, expect, it } from 'vitest'
import { getStuckRecoveryForce, updateStuckRecovery } from '@/domains/combat/combat.stuck-recovery'
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

describe('stuck recovery', () => {
  it('enables deterministic avoidance after repeated low progress ticks', () => {
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 100, y: 100 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 300, y: 100 })

    for (let i = 0; i < 10; i++) {
      updateStuckRecovery(unit, target, 200, false)
    }

    expect(unit.stuckTicks).toBeGreaterThanOrEqual(8)
    expect(unit.avoidanceTicks).toBeGreaterThan(0)
    expect(unit.avoidanceSide === -1 || unit.avoidanceSide === 1).toBe(true)
  })

  it('resets when unit reaches attack range', () => {
    const unit = makeUnit({ id: 'unit', team: 'attacker', x: 100, y: 100, stuckTicks: 9, avoidanceTicks: 10 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 110, y: 100 })

    updateStuckRecovery(unit, target, 10, true)

    expect(unit.stuckTicks).toBe(0)
    expect(unit.avoidanceTicks).toBe(0)
    expect(unit.lastTargetDistance).toBeUndefined()
  })

  it('produces tangent force around nearby obstacles while recovering', () => {
    const unit = makeUnit({
      id: 'unit',
      team: 'attacker',
      x: 120,
      y: 100,
      avoidanceTicks: 5,
      avoidanceSide: 1,
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 300, y: 100 })

    const recovery = getStuckRecoveryForce(unit, target, [{ x: 100, y: 100, radius: 35 }])

    expect(recovery.isRecovering).toBe(true)
    expect(Math.hypot(recovery.forceX, recovery.forceY)).toBeGreaterThan(0)
    expect(unit.avoidanceTicks).toBe(4)
  })
})

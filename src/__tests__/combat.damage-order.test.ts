import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { applyStatus } from '@/domains/combat/combat.status'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(id: string, team: Team, overrides: Partial<SimUnit> = {}): SimUnit {
  return {
    id, team, type: 'marine', hp: 1000, maxHp: 1000, attack: 100, defense: 0,
    speed: 100, range: 120, attackType: 'single', actionCooldownMax: 10,
    actionCooldown: 0, isFlying: false, canTargetAir: false, x: 0, y: 0,
    isDead: false, turnSpeed: 10, currentAngle: 0, size: 'S', shield: 0,
    maxShield: 0, statusEffects: [], aggroLockTicks: 0, velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat damage-order contract', () => {
  it('applies finite barrier before vulnerability/mark and shield after amplification', () => {
    const attacker = makeUnit('attacker', 'attacker')
    const target = makeUnit('target', 'defender', {
      shield: 100,
      maxShield: 100,
      targetMark: { sourceUnitId: 'attacker', duration: 10, damageMultiplier: 0.5 },
    })
    applyStatus(target, { type: 'vulnerable', duration: 10, value: 0.5 })
    const barrier: SimHazard = { id: 'barrier', sourceUnitId: 'guard', team: 'defender', type: 'barrier_dome', x: 0, y: 0, radius: 100, damagePerTick: 0, duration: 10, capacity: 30, maxCapacity: 30 }

    const result = applyCombatDamage(attacker, target, 100, [], { hazards: [barrier], units: [attacker, target] })

    expect(barrier.capacity).toBe(0)
    expect(target.shield).toBe(0)
    expect(target.hp).toBe(943)
    expect(result.damage).toBe(57)
    expect(result.barrierBlockedDamage).toBe(30)
  })

  it('applies flat block before shields', () => {
    const attacker = makeUnit('attacker', 'attacker')
    const target = makeUnit('target', 'defender', {
      shield: 30,
      maxShield: 30,
      flatDamageBlock: { amount: 10 },
    })

    const result = applyCombatDamage(attacker, target, 50)

    expect(result.shieldDamage).toBe(30)
    expect(result.damage).toBe(10)
    expect(target.hp).toBe(990)
  })
})


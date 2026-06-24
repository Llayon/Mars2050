import { describe, it, expect } from 'vitest'
import {
  squadIdFromSurvivor,
  unitIsAlive,
  computeBattlePersistence,
} from '@/domains/pvp/pvp.persistence'
import type { UnitRow, SimUnit } from '@/domains/combat/combat.types'

describe('pvp.persistence — squad mapping contract', () => {
  it('squadIdFromSurvivor: extracts baseId from "${baseId}_${i}"', () => {
    expect(squadIdFromSurvivor('u1_0')).toBe('u1')
    expect(squadIdFromSurvivor('u1_5')).toBe('u1')
    expect(squadIdFromSurvivor('uuid_3')).toBe('uuid')
  })

  it('squadIdFromSurvivor: returns null for non-squad ids', () => {
    expect(squadIdFromSurvivor('u1')).toBeNull()
    expect(squadIdFromSurvivor('u1_')).toBeNull()
    expect(squadIdFromSurvivor('_5')).toBeNull()
    expect(squadIdFromSurvivor('u1_abc')).toBeNull()
  })

  it('unitIsAlive: direct survivor present', () => {
    const survivors = new Set(['u1', 'u2'])
    expect(unitIsAlive('u1', survivors)).toBe(true)
    expect(unitIsAlive('u3', survivors)).toBe(false)
  })

  it('unitIsAlive: squad survivors with no direct survivor', () => {
    const survivors = new Set(['u1_0', 'u1_1', 'u1_2'])
    expect(unitIsAlive('u1', survivors)).toBe(true)
    expect(unitIsAlive('u2', survivors)).toBe(false)
  })

  it('computeBattlePersistence: marks dead and updates HP', () => {
    const attackerUnits: UnitRow[] = [
      { id: 'a1', colony_id: 'c1', unit_type: 'marine', hp_current: 100, grid_x: '0', grid_y: '0', tier: 1, upgrade_path: [] },
      { id: 'a2', colony_id: 'c1', unit_type: 'marine', hp_current: 100, grid_x: '0', grid_y: '0', tier: 1, upgrade_path: [] },
    ]
    const defenderUnits: UnitRow[] = [
      { id: 'd1', colony_id: 'c2', unit_type: 'marine', hp_current: 100, grid_x: '0', grid_y: '0', tier: 1, upgrade_path: [] },
    ]
    const survivors: SimUnit[] = [
      { id: 'a1', team: 'attacker', type: 'marine', hp: 30, maxHp: 100, attack: 0, defense: 0, speed: 0, range: 0, attackType: 'single', actionCooldownMax: 0, actionCooldown: 0, isFlying: false, canTargetAir: false, currentAngle: 0, size: 'S', shield: 0, maxShield: 0, statusEffects: [], x: 0, y: 0, isDead: false, turnSpeed: 0, aggroLockTicks: 0, velocity: { x: 0, y: 0 } },
      { id: 'a2_0', team: 'attacker', type: 'marine', hp: 80, maxHp: 100, attack: 0, defense: 0, speed: 0, range: 0, attackType: 'single', actionCooldownMax: 0, actionCooldown: 0, isFlying: false, canTargetAir: false, currentAngle: 0, size: 'S', shield: 0, maxShield: 0, statusEffects: [], x: 0, y: 0, isDead: false, turnSpeed: 0, aggroLockTicks: 0, velocity: { x: 0, y: 0 } },
      { id: 'a2_1', team: 'attacker', type: 'marine', hp: 60, maxHp: 100, attack: 0, defense: 0, speed: 0, range: 0, attackType: 'single', actionCooldownMax: 0, actionCooldown: 0, isFlying: false, canTargetAir: false, currentAngle: 0, size: 'S', shield: 0, maxShield: 0, statusEffects: [], x: 0, y: 0, isDead: false, turnSpeed: 0, aggroLockTicks: 0, velocity: { x: 0, y: 0 } },
    ]

    const r = computeBattlePersistence(attackerUnits, defenderUnits, survivors)
    expect(r.deadAttackerBaseIds).toEqual([])
    expect(r.deadDefenderBaseIds).toEqual(['d1'])
    const hpForA1 = r.hpUpdates.find((u) => u.id === 'a1')
    expect(hpForA1?.hp_current).toBe(30)
    const hpForA2 = r.hpUpdates.find((u) => u.id === 'a2')
    expect(hpForA2).toBeDefined()
    expect(hpForA2!.hp_current).toBeGreaterThan(0)
    expect(hpForA2!.hp_current).toBeLessThanOrEqual(100)
  })
})

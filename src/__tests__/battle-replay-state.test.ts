import { describe, expect, it } from 'vitest'
import { buildReplayRenderUnits } from '@/components/game/battle-replay-state'
import type { BattleTick, UnitRow } from '@/domains/combat/combat.types'

function unitRow(id: string, type: string): UnitRow {
  return {
    id,
    colony_id: 'attacker',
    unit_type: type,
    hp_current: 100,
    tier: 1,
    upgrade_path: [],
    grid_x: '100',
    grid_y: '800',
  } as UnitRow
}

describe('battle replay render state', () => {
  it('reconstructs squad member sprites from replay action ids', () => {
    const logs: BattleTick[] = [
      {
        tick: 0,
        actions: [
          { unitId: 'shock_0', type: 'move', fromX: 90, fromY: 790, toX: 92, toY: 788 },
          { unitId: 'shock_1', type: 'move', fromX: 110, fromY: 810, toX: 112, toY: 808 },
        ],
      },
    ]

    const units = buildReplayRenderUnits([unitRow('shock', 'shock_trooper')], [], logs, [])

    expect(units).toHaveLength(2)
    expect(units.map(u => (u.unit as UnitRow).id).sort()).toEqual(['shock_0', 'shock_1'])
    expect(units.map(u => (u.unit as UnitRow).grid_x).sort()).toEqual(['110', '90'])
  })

  it('prefers expanded initial state when available', () => {
    const initialState = [{
      id: 'shock_0',
      team: 'attacker' as const,
      type: 'shock_trooper',
      hp: 45,
      maxHp: 45,
      attack: 14,
      defense: 3,
      speed: 150,
      range: 20,
      attackType: 'single' as const,
      actionCooldownMax: 7,
      actionCooldown: 0,
      isFlying: false,
      canTargetAir: false,
      x: 95,
      y: 795,
      isDead: false,
      aggroLockTicks: 0,
      velocity: { x: 0, y: 0 },
      turnSpeed: 40,
      currentAngle: Math.PI / 2,
      size: 'S' as const,
      shield: 0,
      maxShield: 0,
      statusEffects: [],
    }]

    const units = buildReplayRenderUnits([unitRow('shock', 'shock_trooper')], [], [], initialState)

    expect(units).toHaveLength(1)
    expect(units[0].isSimUnit).toBe(true)
    expect(units[0].unit.id).toBe('shock_0')
  })
})

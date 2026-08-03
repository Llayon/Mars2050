import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('combat ECS self destruct', () => {
  it('keeps self-destruct weapons as ground contact damage', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES)) {
      const stats = config.baseStats
      if (!stats.selfDestructOnAttack) continue

      expect(['damage', 'aoe'], unitType).toContain(stats.attackType)
      expect(stats.attack, unitType).toBeGreaterThan(0)
      expect(stats.range, unitType).toBeLessThanOrEqual(1)
      expect(stats.isFlying, unitType).not.toBe(true)
    }
  })

  it('damages the target and resolves the attacker death without kill credit', () => {
    const result = simulateBattle(
      [row('drone', 'attacker', 'explosive_drone')],
      [row('walker', 'defender', 'light_walker')],
      24680,
    )
    const actions = result.logs.flatMap(log => log.actions)
    const selfDestructIndex = actions.findIndex(action =>
      action.type === 'self_destruct' && action.unitId.startsWith('drone_'))
    const deathIndex = actions.findIndex(action =>
      action.type === 'die'
      && action.unitId.startsWith('drone_')
      && action.cause === 'self_destruct')

    expect(selfDestructIndex).toBeGreaterThanOrEqual(0)
    expect(deathIndex).toBeGreaterThan(selfDestructIndex)
    expect(actions).toContainEqual(expect.objectContaining({
      type: 'percent_hp_damage',
      targetId: 'walker',
    }))
    expect(actions.some(action =>
      action.type === 'on_kill' && action.unitId === 'walker')).toBe(false)
  })
})

function row(
  id: string,
  team: 'attacker' | 'defender',
  unitType: 'explosive_drone' | 'light_walker',
): UnitRow {
  return {
    id,
    colony_id: team,
    unit_type: unitType,
    hp_current: UNIT_TYPES[unitType].baseStats.hp,
    tier: 1,
    upgrade_path: [],
    grid_x: '300',
    grid_y: team === 'attacker' ? '700' : '500',
  }
}

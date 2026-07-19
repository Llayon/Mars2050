import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('combat mobility mode engine contract', () => {
  it('maps jetpack config and emits deterministic mode changes', () => {
    const attackers: UnitRow[] = [{
      id: 'jetpack', colony_id: 'a', unit_type: 'jetpack_trooper', hp_current: 45,
      grid_x: '100', grid_y: '500', tier: 1, upgrade_path: [],
    }]
    const defenders: UnitRow[] = [{
      id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500,
      grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [],
    }]

    const result = simulateBattle(attackers, defenders, 41, [])
    const jetpack = result.initialState.find(unit => unit.id === 'jetpack_0')
    const actions = result.logs.flatMap(log => log.actions)

    expect(jetpack?.modeSwitchConfig).toMatchObject({
      trigger: 'while_moving', startMode: 'ground',
    })
    expect(jetpack).toMatchObject({ mobilityMode: 'ground', isFlying: false })
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'jetpack_0', type: 'mode_change', modeState: 'air',
    }))
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'jetpack_0', type: 'mode_change', modeState: 'ground',
    }))
  })
})

import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'

describe('combat stance engine contract', () => {
  it('maps artillery config and deploys before attacking', () => {
    const attackers: UnitRow[] = [{
      id: 'art', colony_id: 'a', unit_type: 'artillery_crawler', hp_current: 250,
      grid_x: '200', grid_y: '100', tier: 1, upgrade_path: [],
    }]
    const defenders: UnitRow[] = [{
      id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500,
      grid_x: '200', grid_y: '570', tier: 1, upgrade_path: [],
    }]

    const result = simulateBattle(attackers, defenders, 7, [])
    const artillery = result.initialState.find(unit => unit.id === 'art')
    const actions = result.logs.flatMap(log => log.actions)

    expect(artillery?.stanceConfig).toMatchObject({
      mode: 'siege', deployTicks: 1, rangeMultiplier: 1.2,
    })
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'art', type: 'stance_change', stanceMode: 'deployed',
    }))
    expect(actions.some(action =>
      action.unitId === 'art' && action.type === 'attack',
    )).toBe(true)
  })
})

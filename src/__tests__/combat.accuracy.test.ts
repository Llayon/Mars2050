import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

function createWorld(): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const target = createRuntimeUnitFromConfig({
    id: 'target', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const world = new CombatWorld([attacker, target])
  world.stores.combat.require(1).defense = 0
  Object.assign(world.stores.vitality.require(1), { hp: 100, maxHp: 100 })
  return world
}

describe('combat accuracy suppression', () => {
  it('converts accuracy reduction into deterministic glancing damage', () => {
    const world = createWorld()
    world.stores.statusControl.require(0).statusEffects.push(
      normalizeStatusEffect({ type: 'accuracy_reduced', duration: 5, value: 0.4 }),
    )

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.damage).toBe(30)
    expect(world.stores.vitality.require(1).hp).toBe(70)
  })

  it('lets thermal optics resist accuracy penalties without changing clean hits', () => {
    const world = createWorld()
    world.stores.combat.require(0).accuracyPenaltyResist = 0.6
    world.stores.statusControl.require(0).statusEffects.push(
      normalizeStatusEffect({ type: 'accuracy_reduced', duration: 5, value: 0.5 }),
    )

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.damage).toBe(40)
    expect(world.stores.vitality.require(1).hp).toBe(60)
  })

  it('maps thermal optics upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'sniper', colony_id: 'a', unit_type: 'sniper', hp_current: 30, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['thermal_optics'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 31, [])
    const sniper = result.initialState.find(unit => unit.id === 'sniper_0')

    expect(sniper?.accuracyPenaltyResist).toBe(0.6)
    expect(sniper?.attack).toBe(60)
  })
})

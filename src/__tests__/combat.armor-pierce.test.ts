import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

function createWorld(defense: number): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const target = createRuntimeUnitFromConfig({
    id: 'target', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const world = new CombatWorld([attacker, target])
  world.stores.combat.require(0).armorPierceRatio = 0.5
  world.stores.combat.require(1).defense = defense
  Object.assign(world.stores.vitality.require(1), { hp: 100, maxHp: 100 })
  return world
}

describe('combat armor pierce', () => {
  it('reduces target defense for the attacker hit without applying a status', () => {
    const world = createWorld(20)

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.damage).toBe(40)
    expect(world.stores.vitality.require(1).hp).toBe(60)
    expect(world.stores.statusControl.require(1).statusEffects).toEqual([])
  })

  it('does not increase damage against unarmored targets', () => {
    const world = createWorld(0)

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.damage).toBe(50)
    expect(world.stores.vitality.require(1).hp).toBe(50)
  })

  it('stacks after armor broken reduces the target defense pool', () => {
    const world = createWorld(20)
    world.stores.statusControl.require(1).statusEffects.push(
      normalizeStatusEffect({ type: 'armor_broken', duration: 5, value: 0.5 }),
    )

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.damage).toBe(45)
    expect(world.stores.vitality.require(1).hp).toBe(55)
  })

  it('maps armor-piercing upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'rail', colony_id: 'a', unit_type: 'railgun_walker', hp_current: 250, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['armor_piercing_rounds'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 17, [])
    const rail = result.initialState.find(unit => unit.id === 'rail')

    expect(rail?.armorPierceRatio).toBe(0.5)
    expect(rail?.attack).toBe(108)
  })
})

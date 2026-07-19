import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { getEcsCombatTags } from '@/domains/combat/ecs/targeting-evaluation'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems'

function createWorld(): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'hunter', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const factory = createRuntimeUnitFromConfig({
    id: 'factory', team: 'defender', type: 'mobile_factory', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const marine = createRuntimeUnitFromConfig({
    id: 'marine', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  const summoned = createRuntimeUnitFromConfig({
    id: 'summoned', team: 'defender', type: 'marine', x: 0, y: 0,
    currentAngle: Math.PI, summonOwnerId: 'factory',
  })!
  const temporary = createRuntimeUnitFromConfig({
    id: 'temporary', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  temporary.isTemporary = true
  const world = new CombatWorld([attacker, factory, marine, summoned, temporary])
  world.stores.combat.require(0).summonCounterDamageMult = 1.75
  for (const targetId of [1, 2, 3, 4]) {
    world.stores.combat.require(targetId).defense = 0
    Object.assign(world.stores.vitality.require(targetId), { hp: 200, maxHp: 200 })
  }
  return world
}

describe('combat anti-summoner counter', () => {
  it('amplifies damage against summoner units without applying a status', () => {
    const world = createWorld()

    const result = applyEcsSingleDamage(world, 0, 1, 40, [])

    expect(result.damage).toBe(70)
    expect(world.stores.vitality.require(1).hp).toBe(130)
    expect(world.stores.statusControl.require(1).statusEffects).toEqual([])
  })

  it('does not increase damage against normal units', () => {
    const world = createWorld()

    const result = applyEcsSingleDamage(world, 0, 2, 40, [])

    expect(result.damage).toBe(40)
    expect(world.stores.vitality.require(2).hp).toBe(160)
  })

  it('amplifies damage against summoned or temporary units', () => {
    const world = createWorld()

    expect(applyEcsSingleDamage(world, 0, 3, 40, []).damage).toBe(70)
    expect(applyEcsSingleDamage(world, 0, 4, 40, []).damage).toBe(70)
  })

  it('exposes summoned units as targeting tags', () => {
    const world = createWorld()

    expect(getEcsCombatTags(world, 3)).toContain('summoned')
  })

  it('maps anti-summoner upgrades into runtime units', () => {
    const attackers: UnitRow[] = [{ id: 'hunter', colony_id: 'a', unit_type: 'bounty_hunter', hp_current: 120, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['anti_summoner_protocol'] }]
    const defenders: UnitRow[] = [{ id: 'factory', colony_id: 'd', unit_type: 'mobile_factory', hp_current: 900, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 23, [])
    const hunter = result.initialState.find(unit => unit.id === 'hunter')

    expect(hunter?.summonCounterDamageMult).toBe(1.75)
    expect(hunter?.attack).toBe(72)
  })
})

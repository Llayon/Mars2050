import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsSingleDamage, applyEcsStatus } from '@/domains/combat/ecs/systems'

function createWorld(): CombatWorld {
  const attacker = createRuntimeUnitFromConfig({
    id: 'attacker', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0,
  })!
  const target = createRuntimeUnitFromConfig({
    id: 'target', team: 'defender', type: 'marine', x: 0, y: 0, currentAngle: Math.PI,
  })!
  target.isBurrowed = true
  target.burrowConfig = { damageReduction: 0.45 }
  const world = new CombatWorld([attacker, target])
  world.stores.combat.require(1).defense = 0
  Object.assign(world.stores.vitality.require(1), { hp: 100, maxHp: 100 })
  return world
}

describe('combat ECS burrow contract', () => {
  it('reduces incoming damage while burrowed', () => {
    const world = createWorld()

    const result = applyEcsSingleDamage(world, 0, 1, 100, [])

    expect(result.damage).toBe(55)
    expect(world.stores.vitality.require(1).hp).toBe(45)
  })

  it('reveal forces a burrowed unit to surface before damage', () => {
    const world = createWorld()
    const actions: BattleAction[] = []

    applyEcsStatus(world, 1, { type: 'revealed', duration: 5 }, actions)
    const result = applyEcsSingleDamage(world, 0, 1, 100, actions)

    expect(world.stores.movement.require(1).isBurrowed).toBe(false)
    expect(result.damage).toBe(100)
    expect(actions.slice(0, 2)).toEqual([
      { unitId: 'target', type: 'status_apply', statusType: 'revealed', value: undefined },
      { unitId: 'target', type: 'burrow_change', value: 0 },
    ])
  })

  it('maps subterranean blitz through the engine boundary', () => {
    const attackers: UnitRow[] = [{
      id: 'shock', colony_id: 'a', unit_type: 'shock_trooper', hp_current: 45,
      grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['subterranean_blitz'],
    }]
    const defenders: UnitRow[] = [{
      id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500,
      grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [],
    }]

    const result = simulateBattle(attackers, defenders, 37, [])
    const shock = result.initialState.find(unit => unit.id === 'shock_0')
    const actions = result.logs.flatMap(log => log.actions)

    expect(shock?.burrowConfig).toEqual({ damageReduction: 0.45 })
    expect(shock?.speed).toBe(180)
    expect(actions).toContainEqual(expect.objectContaining({
      unitId: 'shock_0', type: 'burrow_change', value: 1,
    }))
  })
})

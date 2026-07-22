import { describe, expect, it } from 'vitest'
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
  Object.assign(world.stores.vitality.require(1), { hp: 1000, maxHp: 1000 })
  return world
}

describe('combat damage-order contract', () => {
  it('applies finite barrier before vulnerability/mark and shield after amplification', () => {
    const world = createWorld()
    Object.assign(world.stores.vitality.require(1), { shield: 100, maxShield: 100 })
    const targetStatus = world.stores.statusControl.require(1)
    targetStatus.targetMark = {
      sourceUnitId: 'attacker', duration: 10, damageMultiplier: 0.5,
    }
    world.stores.entitySources.require(1).targetMarkSource = 0
    targetStatus.statusEffects.push({
      type: 'vulnerable', duration: 10, value: 0.5, tickInterval: 0, nextTickIn: 0,
    })
    world.queueHazardCreation({
      id: 'barrier', sourceUnitId: 'guard', team: 'defender',
      type: 'barrier_dome', x: 0, y: 0, radius: 100,
      damagePerTick: 0, duration: 10, capacity: 30, maxCapacity: 30,
    })
    world.flushStructuralCommands()

    const result = applyEcsSingleDamage(world, 0, 1, 100, [])

    expect(world.getHazard(world.getEntityId('barrier')!)).toMatchObject({ capacity: 0 })
    expect(world.stores.vitality.require(1)).toMatchObject({ shield: 0, hp: 943 })
    expect(result.damage).toBe(57)
    expect(result.barrierBlockedDamage).toBe(30)
  })

  it('applies flat block before shields', () => {
    const world = createWorld()
    Object.assign(world.stores.vitality.require(1), { shield: 30, maxShield: 30 })
    world.stores.defense.require(1).flatDamageBlock = { amount: 10 }

    const result = applyEcsSingleDamage(world, 0, 1, 50, [])

    expect(result.shieldDamage).toBe(30)
    expect(result.damage).toBe(10)
    expect(world.stores.vitality.require(1).hp).toBe(990)
  })
})

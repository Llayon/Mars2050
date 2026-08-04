import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

describe('ECS initiative groups', () => {
  it('lets equal-speed lethal actors complete their planned actions', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'attacker', team: 'attacker', type: 'marine', x: 100, y: 400, currentAngle: 0,
    })!
    const defender = createRuntimeUnitFromConfig({
      id: 'defender', team: 'defender', type: 'marine', x: 180, y: 400, currentAngle: Math.PI,
    })!
    attacker.attack = 200
    defender.attack = 200
    attacker.hp = defender.hp = 100
    attacker.maxHp = defender.maxHp = 100

    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(attacker, defender)
    runtime.flushStructuralCommands()
    const actions: Parameters<typeof runtime.runPhase>[1]['actions'] = []
    runtime.runPhase('actor_turn', { tick: 0, actions, rng: new PRNG(7) })

    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
    expect(runtime.world.stores.vitality.require(1).isDead).toBe(true)
    expect(actions.filter(action => action.type === 'attack')).toHaveLength(2)
  })

  it('is invariant to structural creation order for equal-speed actors', () => {
    const run = (reverse: boolean) => {
      const units = ['a', 'b'].map((id, index) => {
        const unit = createRuntimeUnitFromConfig({
          id, team: index === 0 ? 'attacker' : 'defender', type: 'marine',
          x: index === 0 ? 100 : 180, y: 400,
          currentAngle: index === 0 ? 0 : Math.PI,
        })!
        unit.attack = 24
        unit.hp = unit.maxHp = 100
        return unit
      })
      const runtime = createEcsCombatRuntime()
      runtime.world.queueUnitCreation(...(reverse ? units.reverse() : units))
      runtime.flushStructuralCommands()
      const actions: Parameters<typeof runtime.runPhase>[1]['actions'] = []
      runtime.runPhase('actor_turn', { tick: 0, actions, rng: new PRNG(7) })
      return {
        hp: runtime.world.snapshot().sort((left, right) => left.id.localeCompare(right.id)).map(unit => unit.hp),
        attackCount: actions.filter(action => action.type === 'attack').length,
      }
    }

    expect(run(true)).toEqual(run(false))
  })

  it('resolves faster groups before slower groups', () => {
    const attacker = createRuntimeUnitFromConfig({
      id: 'fast-attacker', team: 'attacker', type: 'marine', x: 100, y: 400, currentAngle: 0,
    })!
    const defender = createRuntimeUnitFromConfig({
      id: 'slow-defender', team: 'defender', type: 'marine', x: 180, y: 400, currentAngle: Math.PI,
    })!
    attacker.attack = 200
    attacker.speed = 10
    defender.speed = 5
    attacker.hp = defender.hp = 100
    attacker.maxHp = defender.maxHp = 100

    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(attacker, defender)
    runtime.flushStructuralCommands()
    const actions: Parameters<typeof runtime.runPhase>[1]['actions'] = []
    runtime.runPhase('actor_turn', { tick: 0, actions, rng: new PRNG(7) })

    expect(actions.filter(action => action.type === 'attack')).toHaveLength(1)
    expect(runtime.world.stores.vitality.require(1).isDead).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status-core'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function unit(id: string, team: 'attacker' | 'defender'): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x: team === 'attacker' ? 100 : 200,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

describe('combat ECS status death', () => {
  it('resolves sourced burn death and native death-trigger effects', () => {
    const attacker = unit('burner', 'attacker')
    const target = unit('target', 'defender')
    target.hp = 5
    target.statusEffects = [
      normalizeStatusEffect({
        type: 'burn',
        duration: 1,
        value: 10,
        tickInterval: 1,
        sourceUnitId: attacker.id,
      }),
    ]
    target.triggerEffects = [{
      id: 'last-shield',
      event: 'death',
      payload: { kind: 'shield', target: 'killer', amount: 15 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(attacker, target)
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(107))

    runtime.runPhase('status', { tick: 0, actions: nativeActions, rng: new PRNG(107) })

    expect(nativeActions).toContainEqual({
      unitId: 'target',
      type: 'die',
      sourceUnitId: 'burner',
      cause: 'burn',
    })
    expect(nativeActions.at(-1)).toEqual({
      unitId: 'target',
      type: 'status_expire',
      statusType: 'burn',
    })
    expect(runtime.world.stores.vitality.require(0).shield).toBe(15)
  })

  it('resolves source-less degeneration without kill credit', () => {
    const target = unit('decaying', 'defender')
    target.hp = 3
    target.statusEffects = [
      normalizeStatusEffect({
        type: 'degeneration',
        duration: 2,
        value: 5,
        tickInterval: 1,
      }),
    ]
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(target)
    runtime.world.flushStructuralCommands()
    runtime.world.resources.set('rng', new PRNG(109))

    runtime.runPhase('status', { tick: 0, actions: nativeActions, rng: new PRNG(109) })

    expect(nativeActions).toContainEqual({
      unitId: 'decaying',
      type: 'die',
      cause: 'degeneration',
    })
    expect(nativeActions.some(action => action.type === 'on_kill')).toBe(false)
    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
  })

  it('does not overwrite canonical periodic status state from the facade', () => {
    const attacker = unit('canonical-source', 'attacker')
    const target = unit('canonical-target', 'defender')
    target.hp = 5
    target.statusEffects = [
      normalizeStatusEffect({
        type: 'burn',
        duration: 1,
        value: 10,
        tickInterval: 1,
        sourceUnitId: attacker.id,
      }),
    ]
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(attacker, target)
    runtime.flushStructuralCommands()
    target.hp = target.maxHp
    target.statusEffects = []
    const actions: BattleAction[] = []

    runtime.runPhase('status', { tick: 0, actions, rng: new PRNG(113) })

    const targetId = runtime.world.getEntityId(target.id)!
    expect(actions).toContainEqual({
      unitId: 'canonical-target',
      type: 'die',
      sourceUnitId: 'canonical-source',
      cause: 'burn',
    })
    expect(runtime.world.stores.vitality.require(targetId).isDead).toBe(true)
  })
})

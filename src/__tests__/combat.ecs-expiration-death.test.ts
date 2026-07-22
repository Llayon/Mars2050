import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { resolveEcsDeath, runModifierSystem } from '@/domains/combat/ecs/systems'

function temporaryUnit(): SimUnit {
  const unit = createRuntimeUnitFromConfig({
    id: 'temporary',
    team: 'attacker',
    type: 'marine',
    x: 100,
    y: 100,
    currentAngle: 0,
    isTemporary: true,
    temporaryDuration: 1,
  })!
  unit.resurrectOnce = true
  unit.reassemblyConfig = { delayTicks: 2, hpPercent: 0.5 }
  unit.onDeathPuddle = 'acid'
  unit.triggerEffects = [{
    id: 'must-not-fire',
    event: 'death',
    payload: { kind: 'shield', target: 'self', amount: 20 },
    fired: false,
    counter: 0,
    cooldownRemaining: 0,
  }]
  return unit
}

describe('combat ECS expiration death', () => {
  it('expires natively without combat death effects or facade callback', () => {
    const unit = temporaryUnit()
    const nativeActions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(unit)
    runtime.world.flushStructuralCommands()

    runModifierSystem(runtime.world, 0, nativeActions, entityId => {
      resolveEcsDeath(runtime.world, entityId, undefined, nativeActions, 'expiration')
    })

    expect(nativeActions).toEqual([{
      unitId: 'temporary',
      type: 'die',
      sourceUnitId: undefined,
      cause: 'expiration',
    }])
    expect(runtime.world.snapshotHazards()).toEqual([])
    expect(runtime.world.stores.vitality.require(0)).toMatchObject({
      hp: unit.maxHp,
      isDead: true,
      resurrectOnce: true,
    })
    expect(runtime.world.stores.vitality.require(0).reassemblyState).toBeUndefined()
    expect(runtime.world.stores.lifecycle.require(0).triggerEffects?.[0].fired)
      .toBe(false)
  })

  it('ticks canonical cooldown and lifetime without importing facade state', () => {
    const unit = temporaryUnit()
    unit.actionCooldown = 3
    const actions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.queueUnitCreation(unit)
    runtime.world.flushStructuralCommands()

    unit.actionCooldown = 99
    unit.isTemporary = false
    unit.temporaryDuration = 99

    runModifierSystem(runtime.world, 0, actions, entityId => {
      resolveEcsDeath(runtime.world, entityId, undefined, actions, 'expiration')
    })

    expect(actions).toEqual([{
      unitId: 'temporary',
      type: 'die',
      sourceUnitId: undefined,
      cause: 'expiration',
    }])
    expect(runtime.world.stores.combat.require(0).actionCooldown).toBe(2)
    expect(runtime.world.stores.vitality.require(0)).toMatchObject({
      isDead: true,
      isTemporary: true,
      temporaryDuration: 0,
    })
  })
})

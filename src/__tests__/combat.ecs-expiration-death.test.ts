import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createLegacyCombatRuntime } from '@/domains/combat/combat.legacy-runtime'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

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
    const legacy = structuredClone(unit)
    const legacyActions: BattleAction[] = []
    const nativeActions: BattleAction[] = []
    const legacyRuntime = createLegacyCombatRuntime()
    legacyRuntime.units.push(legacy)
    legacyRuntime.tickModifiers(legacy, 0.1, legacyActions, new PRNG(131))
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(unit)
    runtime.world.flushStructuralCommands()

    runtime.tickModifiers(unit, 0.1, nativeActions, new PRNG(131))

    expect(nativeActions).toEqual(legacyActions)
    expect(runtime.world.snapshotEntity(0)).toEqual(legacy)
    expect(nativeActions).toEqual([{
      unitId: 'temporary',
      type: 'die',
      sourceUnitId: undefined,
      cause: 'expiration',
    }])
    expect(runtime.hazards).toEqual([])
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
    runtime.world.roster.push(unit)
    runtime.world.flushStructuralCommands()

    unit.actionCooldown = 99
    unit.isTemporary = false
    unit.temporaryDuration = 99

    runtime.tickModifiers(unit, 0.1, actions, new PRNG(137))

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
    expect(unit).toMatchObject({
      actionCooldown: 2,
      isDead: true,
      isTemporary: true,
      temporaryDuration: 0,
    })
  })
})

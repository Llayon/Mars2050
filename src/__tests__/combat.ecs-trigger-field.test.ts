import { describe, expect, it } from 'vitest'
import { applyFieldEffectAt } from '@/domains/combat/combat.field-effects'
import type {
  FieldEffectConfig,
  SimHazard,
  SimUnit,
  TriggerPayload,
} from '@/domains/combat/combat.sim.types'
import { normalizeStatusEffect } from '@/domains/combat/combat.status'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { applyEcsTriggerField } from '@/domains/combat/ecs/systems'

type FieldPayload = Extract<TriggerPayload, { kind: 'field' }>

function unit(
  id: string,
  team: 'attacker' | 'defender',
  x: number,
): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

function payload(field: FieldEffectConfig): FieldPayload {
  return { kind: 'field', target: 'self', field }
}

describe('combat ECS trigger fields', () => {
  it('matches cleanse ordering, status removal, and control break', () => {
    const source = unit('source', 'attacker', 100)
    const ally = unit('ally', 'attacker', 130)
    const enemy = unit('enemy', 'defender', 120)
    source.statusEffects = [
      normalizeStatusEffect({ type: 'burn', duration: 10, value: 2 }),
      normalizeStatusEffect({ type: 'haste', duration: 10, value: 0.2 }),
    ]
    ally.statusEffects = [
      normalizeStatusEffect({ type: 'regen', duration: 10, value: 2 }),
      normalizeStatusEffect({ type: 'acid', duration: 10, value: 1 }),
    ]
    ally.controlProgress = {
      sourceUnitId: 'controller',
      sourceTeam: 'defender',
      progress: 7,
      threshold: 10,
      breakOnCleanse: true,
    }
    enemy.statusEffects = [
      normalizeStatusEffect({ type: 'burn', duration: 10, value: 2 }),
    ]
    const hazards: SimHazard[] = [
      {
        id: 'near-acid',
        team: 'defender',
        type: 'acid',
        x: 110,
        y: 100,
        radius: 20,
        damagePerTick: 1,
        duration: 10,
      },
      {
        id: 'far-smoke',
        team: 'defender',
        type: 'smoke',
        x: 400,
        y: 100,
        radius: 20,
        damagePerTick: 0,
        duration: 10,
      },
      {
        id: 'near-napalm',
        team: 'defender',
        type: 'napalm',
        x: 90,
        y: 100,
        radius: 20,
        damagePerTick: 1,
        duration: 10,
      },
    ]
    const effect: FieldEffectConfig = {
      id: 'purge',
      kind: 'cleanse_field',
      radius: 80,
      intervalTicks: 20,
    }
    const legacyUnits = structuredClone([source, ally, enemy])
    const legacyHazards = structuredClone(hazards)
    const legacyActions: Parameters<typeof applyFieldEffectAt>[5] = []
    const nativeActions: Parameters<typeof applyEcsTriggerField>[4] = []
    const world = new CombatWorld([source, ally, enemy])
    world.hazards.push(...structuredClone(hazards))
    world.flushStructuralCommands()

    applyFieldEffectAt(
      legacyUnits[0],
      legacyUnits[0],
      effect,
      legacyUnits,
      legacyHazards,
      legacyActions,
      'trigger_5_0',
    )
    world.resources.set('clock', {
      tick: 5,
      dt: 0.1,
      maxTicks: 400,
      timeoutPolicy: 'draw',
    })
    applyEcsTriggerField(world, 0, 0, payload(effect), nativeActions)

    expect(nativeActions).toEqual(legacyActions)
    expect(world.hazards).toEqual(legacyHazards)
    expect(world.snapshot()).toEqual(legacyUnits)
  })

  it('matches anchored hazard creation and cloned statuses', () => {
    const source = unit('source', 'attacker', 100)
    const anchor = unit('anchor', 'defender', 240)
    const effect: FieldEffectConfig = {
      id: 'corrosive-cloud',
      kind: 'hazard_field',
      radius: 55,
      intervalTicks: 30,
      duration: 18,
      hazardType: 'acid',
      damagePerTick: 4,
      statusEffects: [{ type: 'slow', duration: 8, value: 0.7 }],
    }
    const legacyHazards: SimHazard[] = []
    const legacyActions: Parameters<typeof applyFieldEffectAt>[5] = []
    const nativeActions: Parameters<typeof applyEcsTriggerField>[4] = []
    const world = new CombatWorld([source, anchor])
    world.resources.set('clock', {
      tick: 11,
      dt: 0.1,
      maxTicks: 400,
      timeoutPolicy: 'draw',
    })

    applyFieldEffectAt(
      structuredClone(source),
      structuredClone(anchor),
      effect,
      [],
      legacyHazards,
      legacyActions,
      'trigger_11_0',
    )
    applyEcsTriggerField(world, 0, 1, payload(effect), nativeActions)
    world.flushStructuralCommands()

    expect(nativeActions).toEqual(legacyActions)
    expect(world.hazards).toEqual(legacyHazards)
    expect(world.stores.hazard.require(2)).toEqual(legacyHazards[0])
    expect(world.hazards[0].statusEffects).not.toBe(effect.statusEffects)
  })
})

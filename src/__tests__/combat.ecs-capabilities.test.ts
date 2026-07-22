import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'

function unit(id: string) {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x: 10,
    y: 20,
    currentAngle: 0,
  })!
}

describe('combat ECS capability indexes', () => {
  it('queries rare mechanics through narrow structural markers', () => {
    const plain = unit('plain')
    const aura = unit('aura')
    aura.supportAuras = [{ type: 'haste', radius: 100, value: 0.1, target: 'allies' }]
    const periodic = unit('periodic')
    periodic.periodicAbilities = [{
      id: 'pulse',
      intervalTicks: 10,
      nextTick: 0,
      payload: { kind: 'heal', amount: 1 },
    }]
    aura.statusEffects = [{
      type: 'haste', duration: 5, tickInterval: 0, nextTickIn: 0,
    }]
    periodic.controlProgress = {
      sourceUnitId: 'plain', sourceTeam: 'attacker', progress: 1,
      threshold: 10, breakOnCleanse: true,
    }
    const world = new CombatWorld([plain, aura, periodic])

    expect(world.query(['identity', 'supportAuraCapability'])).toEqual([1])
    expect(world.query(['identity', 'periodicAbilityCapability'])).toEqual([2])
    expect(world.query(['activeStatusCapability'])).toEqual([1])
    expect(world.query(['activeControlProgressCapability'])).toEqual([2])
    expect(world.getQueryProfile().candidateCount).toBe(4)
    expect(world.snapshotEntity(1)).not.toHaveProperty('present')
  })

  it('invalidates cached membership and preserves capabilities on clones', () => {
    const source = unit('source')
    source.supportAuras = [{ type: 'haste', radius: 100, value: 0.1, target: 'allies' }]
    const world = new CombatWorld([unit('plain'), source])

    expect(world.query(['supportAuraCapability'])).toEqual([1])
    expect(world.query(['supportAuraCapability'])).toEqual([1])
    world.stores.support.require(0).supportAuras = structuredClone(source.supportAuras)
    world.setUnitCapability(0, 'supportAuraCapability', true)
    expect(world.query(['supportAuraCapability'])).toEqual([0, 1])

    world.queueUnitClone(1, 'clone', 30, 40)
    world.flushStructuralCommands()
    expect(world.query(['supportAuraCapability'])).toEqual([0, 1, 2])
  })
})

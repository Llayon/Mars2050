import { describe, expect, it } from 'vitest'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'

function unit(id: string) {
  return createRuntimeUnitFromConfig({
    id, team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0,
  })!
}

describe('combat ECS source codec', () => {
  it('hydrates unit provenance while leaving synthetic sources external', () => {
    const target = unit('target')
    target.statusEffects = [{
      type: 'burn', duration: 10, value: 2, sourceUnitId: 'later-source',
      tickInterval: 1, nextTickIn: 1,
    }, {
      type: 'vulnerable', duration: 10, value: 0.2, sourceUnitId: 'global_event',
      tickInterval: 0, nextTickIn: 0,
    }]
    target.targetMark = { sourceUnitId: 'later-source', duration: 10 }
    target.controlProgress = {
      sourceUnitId: 'later-source', sourceTeam: 'attacker', progress: 1,
      threshold: 10, breakOnCleanse: true,
    }
    const world = new CombatWorld([target, unit('later-source')])
    const sources = world.stores.entitySources.require(0)

    expect(sources.statusSources['burn:later-source']).toBe(1)
    expect(sources.statusSources['vulnerable:global_event']).toBeUndefined()
    expect(sources.targetMarkSource).toBe(1)
    expect(sources.controlProgressSource).toBe(1)
    expect(world.snapshotEntity(0)).not.toHaveProperty('entitySources')
  })

  it('stores hazard ownership as an entity relation', () => {
    const world = new CombatWorld([unit('owner')])
    world.queueHazardCreation({
      id: 'fire', type: 'napalm', team: 'attacker', x: 10, y: 20,
      radius: 10, duration: 20, damagePerTick: 2, sourceUnitId: 'owner',
    })
    world.flushStructuralCommands()

    expect(world.stores.entitySources.require(1).hazardSource).toBe(0)
    expect(world.snapshotHazards()[0]?.sourceUnitId).toBe('owner')
  })
})

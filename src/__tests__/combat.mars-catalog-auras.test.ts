import { describe, expect, it } from 'vitest'
import { buildMarsUnitDefinitions } from '@/domains/combat/combat.unit-definitions'
import { buildMarsUpgrades } from '@/domains/combat/combat.upgrades'
import { buildMarsPreparedStats } from '@/domains/combat/combat.prepared-stats'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { runEcsSupportAuraSystem } from '@/domains/combat/ecs/systems/support-aura-system'
import { mapDefinitionToUnitTypeConfig, type CombatCatalog } from '@mars2050/combat-core'

describe('Mars default catalog: support auras resolution without duplication', () => {
  const rawDefinitions = buildMarsUnitDefinitions()
  const explicitPreviousCatalog: CombatCatalog = {
    unitTypes: Object.fromEntries(Object.entries(rawDefinitions).map(([k, def]) => [k, mapDefinitionToUnitTypeConfig(def)])),
    upgrades: buildMarsUpgrades(),
  }

  it('preserves single-copy authored support auras across all five aura unit types', () => {
    const auraTypes = ['officer', 'engineer', 'shield_emitter', 'radar_zepplin', 'nanite_generator']
    for (const type of auraTypes) {
      const expected = createRuntimeUnitFromConfig({
        id: `${type}-expected`,
        type,
        team: 'attacker',
        x: 300,
        y: 700,
        currentAngle: 0,
        catalog: explicitPreviousCatalog,
      })
      const actual = createRuntimeUnitFromConfig({
        id: `${type}-actual`,
        type,
        team: 'attacker',
        x: 300,
        y: 700,
        currentAngle: 0,
      })

      expect(expected).not.toBeNull()
      expect(actual).not.toBeNull()
      expect(actual!.supportAuras).toEqual(expected!.supportAuras)
    }
  })

  it('engineer repairs shield exactly once for 18 points in runtime factory aura execution', () => {
    const make = (id: string, type: string, x: number, catalog?: typeof explicitPreviousCatalog) =>
      createRuntimeUnitFromConfig({ id, type, team: 'attacker', x, y: 700, currentAngle: 0, catalog })

    const source = make('engineer', 'engineer', 300)!
    const target = make('target', 'plasma_tank', 350)!
    target.shield = 0
    target.maxShield = 100

    const { world } = createEcsCombatRuntime()
    world.queueUnitCreation(source, target)
    world.flushStructuralCommands()

    const actions: import('@/domains/combat/combat.actions').BattleAction[] = []
    runEcsSupportAuraSystem(world, 0, actions)

    const targetId = world.getEntityId('target')
    expect(targetId).toBeDefined()
    const targetShield = world.stores.vitality.require(targetId!).shield
    const shieldEvents = actions.filter(action => action.type === 'shield_apply')

    expect(targetShield).toBe(18)
    expect(shieldEvents).toHaveLength(1)
    expect(shieldEvents[0]).toMatchObject({
      unitId: 'engineer',
      type: 'shield_apply',
      targetId: 'target',
      damage: 18,
    })
  })

  it('matches explicit previous catalog snapshots with upgrades for aura units', () => {
    const expected = buildMarsPreparedStats('officer', 1, ['sensor_suite'], explicitPreviousCatalog)
    const actual = buildMarsPreparedStats('officer', 1, ['sensor_suite'])

    expect(expected).toBeDefined()
    expect(actual).toBeDefined()
    expect(actual?.supportAuras).toEqual(expected?.supportAuras)
    expect(actual?.supportAuras).toHaveLength(2) // haste + reveal from sensor_suite
  })
})

import { describe, expect, it } from 'vitest'
import { periodicAbility } from '@/domains/combat/combat.ability-config'
import { compileAbilityDefinitions } from '@/domains/combat/combat.ability-compiler'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { runEcsPeriodicAbilitySystem } from '@/domains/combat/ecs/systems'

describe('compiled periodic ability programs', () => {
  it('resolves authored payloads for authoritative entities', () => {
    const source = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'marine', x: 100, y: 100, currentAngle: 0 })!
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 130, y: 100, currentAngle: Math.PI })!
    const config = { id: 'pulse', intervalTicks: 1, targetPolicy: 'nearest_enemy' as const, payload: { kind: 'damage' as const, amount: 3 } }
    source.runtimeRules!.abilityProgramsAuthoritative = true
    source.periodicAbilities = undefined
    source.periodicProgramState = [{ ...config, nextTick: 0 }]
    source.periodicPrograms = compileAbilityDefinitions([periodicAbility('marine:periodic:pulse', config)])
    const runtime = createEcsCombatRuntime()
    const world = runtime.world
    world.queueUnitCreation(source, target)
    world.flushStructuralCommands()
    world.resources.require('entitySpatial').rebuild(world)
    const actions: Parameters<typeof runEcsPeriodicAbilitySystem>[2] = []
    runEcsPeriodicAbilitySystem(world, 0, actions)
    expect(actions.some(action => action.type === 'periodic_ability')).toBe(true)
    expect(world.stores.vitality.require(1).hp).toBeLessThan(target.maxHp)
  })
})

import { describe, expect, it } from 'vitest'
import { compareCombatEngines } from '@/domains/combat/combat.shadow'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { cloneRuntimeUnit, createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'

describe('combat ECS shadow engine', () => {
  it('stores mutable runtime state in component stores', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'marine', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })
    expect(unit).not.toBeNull()
    const world = new CombatWorld([unit!])
    const view = world.roster[0]

    view.hp = 17
    view.x = 44

    expect(world.stores.vitality[0]?.hp).toBe(17)
    expect(world.stores.transform[0]?.x).toBe(44)
    world.stores.vitality[0]!.hp = 23
    expect(view.hp).toBe(23)
    expect(world.snapshotEntity(0)).toMatchObject({ id: 'marine', hp: 23, x: 44 })
  })

  it('clones nested loadout state and resets transient statuses', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'officer', x: 10, y: 20, currentAngle: 0 })!
    unit.statusEffects.push({ type: 'burn', duration: 30, tickInterval: 10, nextTickIn: 10 })
    const clone = cloneRuntimeUnit(unit, 'clone', 30, 40)

    clone.supportAuras![0].value = 0.5
    expect(clone.statusEffects).toEqual([])
    expect(unit.statusEffects[0].duration).toBe(30)
    expect(unit.supportAuras![0].value).toBe(0.35)
  })

  it.each(['ranged_duel', 'summon_caps'] as const)('matches legacy replay for %s', presetId => {
    const preset = getSimulatorPreset(presetId)
    expect(preset).not.toBeNull()
    const comparison = compareCombatEngines(preset!.attackers, preset!.defenders, 12345, [])

    expect(comparison.differences).toEqual([])
  }, 30000)

  it('reports deterministic local-query profiling', () => {
    const preset = getSimulatorPreset('ranged_duel')
    expect(preset).not.toBeNull()
    const result = simulateBattle(preset!.attackers, preset!.defenders, 12345, [], [], [], { profile: true })

    expect(result.profile?.queryCount).toBeGreaterThan(0)
    expect(result.profile?.candidateCount).toBeGreaterThanOrEqual(result.profile?.maxCandidates ?? 0)
  })
})

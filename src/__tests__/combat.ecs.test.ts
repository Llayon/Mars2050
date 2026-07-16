import { describe, expect, it } from 'vitest'
import { compareCombatEngines } from '@/domains/combat/combat.shadow'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { cloneRuntimeUnit, createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'

const CORE_SHADOW_PRESETS = ['ranged_duel', 'summon_caps', 'control_status', 'qa_primitive_events'] as const

describe('combat ECS shadow engine', () => {
  it('stores mutable runtime state in component stores', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'marine', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })
    expect(unit).not.toBeNull()
    const world = new CombatWorld([unit!])
    const view = world.roster[0]

    view.hp = 17
    view.x = 44

    world.syncEntityToComponents(0)
    expect(world.stores.vitality.get(0)?.hp).toBe(17)
    expect(world.stores.transform.get(0)?.x).toBe(44)
    world.stores.vitality.require(0).hp = 23
    world.syncEntityFromComponents(0)
    expect(view.hp).toBe(23)
    expect(world.snapshotEntity(0)).toMatchObject({ id: 'marine', hp: 23, x: 44 })
    const snapshot = world.snapshotEntity(0)
    view.velocity.x = 99
    expect(snapshot.velocity.x).toBe(0)
  })

  it('queries entities in monotonic creation order and excludes dead units', () => {
    const first = createRuntimeUnitFromConfig({ id: 'first', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0 })!
    const second = createRuntimeUnitFromConfig({ id: 'second', team: 'defender', type: 'marine', x: 20, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([first, second])

    world.roster[0].isDead = true
    world.syncEntityToComponents(0)

    expect(world.query(['identity', 'transform', 'vitality'])).toEqual([1])
    expect(world.query(['identity', 'transform', 'vitality'], true)).toEqual([0, 1])
    expect(world.getEntityId('second')).toBe(1)
  })

  it('registers hazards as separate ECS entities and reconciles expiration', () => {
    const world = new CombatWorld()
    world.hazards.push({
      id: 'mine-1', team: 'attacker', type: 'mine', x: 10, y: 20,
      radius: 30, damagePerTick: 12, duration: 5,
    })

    const entityId = world.getEntityId('mine-1')
    expect(entityId).toBe(0)
    expect(world.stores.entityMeta.get(entityId!)).toEqual({ kind: 'hazard', externalId: 'mine-1' })
    expect(world.getHazard(entityId!)).toMatchObject({ type: 'mine', duration: 5 })
    expect(world.snapshot()).toEqual([])

    world.hazards.splice(0, 1)
    world.reconcileHazards()
    expect(world.stores.hazard.has(entityId!)).toBe(false)
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

  it.each(CORE_SHADOW_PRESETS)('matches legacy replay for %s', id => {
    const preset = getSimulatorPreset(id)
    expect(preset).not.toBeNull()
    const comparison = compareCombatEngines(preset!.attackers, preset!.defenders, 12345, [], [], [], { trackMetrics: true })

    expect(comparison.differences).toEqual([])
  }, 120000)

  it('reports deterministic local-query profiling', () => {
    const preset = getSimulatorPreset('ranged_duel')
    expect(preset).not.toBeNull()
    const result = simulateBattle(preset!.attackers, preset!.defenders, 12345, [], [], [], { profile: true })

    expect(result.profile?.queryCount).toBeGreaterThan(0)
    expect(result.profile?.candidateCount).toBeGreaterThanOrEqual(result.profile?.maxCandidates ?? 0)
  })
})

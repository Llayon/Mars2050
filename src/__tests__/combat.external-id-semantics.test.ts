import { describe, expect, it } from 'vitest'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { getEcsInitiativeGroups } from '@/domains/combat/ecs/systems'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { getEcsPositioningDecision } from '@/domains/combat/ecs/movement-positioning'
import { getSizeRadius } from '@/domains/combat/combat.utils'
import { runCertifiedProductionCombat } from './helpers/combat-production-runner'
import {
  applyExternalIdProbe,
  canonicalSemanticOrder,
  semanticUnitKey,
} from './helpers/combat-external-id-probes'

describe('combat external-ID semantics', () => {
  it('keeps same-speed initiative sequence under rank-preserving rename', () => {
    const scenario = initiativeScenario()
    const baseline = applyExternalIdProbe(scenario, 'baseline')
    const renamed = applyExternalIdProbe(scenario, 'rank_preserving_a')
    const permuted = applyExternalIdProbe(scenario, 'rank_permuted')

    const baselineSequence = initiativeSequence(baseline)
    expect(initiativeSequence(renamed)).toEqual(baselineSequence)
    expect(initiativeSequence(permuted)).not.toEqual(baselineSequence)
    expect(canonicalSemanticOrder(renamed)).toEqual(canonicalSemanticOrder(baseline))
  })

  it('keeps target ties stable for rank-preserving raw-ID renames', () => {
    const scenario = targetTieScenario()
    const baseline = applyExternalIdProbe(scenario, 'baseline')
    const renamed = applyExternalIdProbe(scenario, 'rank_preserving_b')
    const permuted = applyExternalIdProbe(scenario, 'rank_permuted')

    expect(firstDamageSemantic(baseline)).toBe('target-left')
    expect(firstDamageSemantic(renamed)).toBe(firstDamageSemantic(baseline))
    expect(firstDamageSemantic(permuted)).toBe('target-right')
  })

  it('changes melee waiting destination for rank-preserving raw-ID content', () => {
    const baseline = waitingDestination('base-attacker', 'base-target', true)
    const renamed = waitingDestination('probe-a-0000-base-attacker', 'probe-a-0001-base-target', true)
    const noWaitingBaseline = waitingDestination('base-attacker', 'base-target', false)
    const noWaitingRenamed = waitingDestination('probe-a-0000-base-attacker', 'probe-a-0001-base-target', false)

    expect('base-attacker' < 'base-target').toBe(true)
    expect('probe-a-0000-base-attacker' < 'probe-a-0001-base-target').toBe(true)
    expect(renamed).not.toEqual(baseline)
    expect(noWaitingRenamed).toEqual(noWaitingBaseline)
  })
})

function initiativeSequence(probe: ReturnType<typeof applyExternalIdProbe>): string[] {
  const units = [...probe.attackers, ...probe.defenders].map(rowToSimUnit)
  const world = createWorld(units)
  const identityByExternalId = probe.semanticByExternalId
  return getEcsInitiativeGroups(world)
    .flatMap(group => group.entityIds)
    .map(entityId => {
      const externalId = world.stores.identity.require(entityId).id
      const identity = identityByExternalId.get(externalId)
      if (!identity) throw new Error(`Missing initiative semantic identity for ${externalId}`)
      return semanticUnitKey(identity)
    })
}

function firstDamageSemantic(probe: ReturnType<typeof applyExternalIdProbe>): string {
  const result = runCertifiedProductionCombat(probe.attackers, probe.defenders, 101, [], [], [], { maxTicks: 40 })
  const attackerId = probe.attackers[0].id
  const action = result.logs.flatMap(tick => tick.actions)
    .find(item => item.type === 'damage' && (item.unitId.startsWith(`${attackerId}_`) || item.unitId === attackerId))
  if (!action?.targetId) throw new Error(`Expected target action from ${attackerId}`)
  const identity = probe.semanticByExternalId.get(action.targetId)
  if (!identity) throw new Error(`Missing target semantic identity for ${action.targetId}`)
  return identity.originalRowId
}

function waitingDestination(attackerId: string, targetId: string, waiting: boolean): { x: number; y: number } {
  const attacker = createRuntimeUnitFromConfig({ id: attackerId, team: 'attacker', type: 'shock_trooper', x: 100, y: 100, currentAngle: 0 })
  const target = createRuntimeUnitFromConfig({ id: targetId, team: 'defender', type: 'light_walker', x: 300, y: 300, currentAngle: Math.PI })
  if (!attacker || !target) throw new Error('Expected waiting-position fixture units')
  const world = createWorld([attacker, target])
  const attackerEntity = world.getEntityId(attackerId)
  const targetEntity = world.getEntityId(targetId)
  if (attackerEntity === undefined || targetEntity === undefined) throw new Error('Expected waiting-position fixture entities')
  if (waiting) world.stores.entityTargets.require(attackerEntity).meleeWaitingTarget = targetEntity
  const attackerTransform = world.stores.transform.require(attackerEntity)
  const targetTransform = world.stores.transform.require(targetEntity)
  return getEcsPositioningDecision(
    world,
    attackerEntity,
    targetEntity,
    100,
    getSizeRadius(targetTransform.size),
    getSizeRadius(attackerTransform.size),
  ).point
}

function createWorld(units: SimUnit[]): CombatWorld {
  const world = new CombatWorld(units)
  world.resources.set('defenseResolutionMode', 'v9_snapshot')
  return world
}

function row(id: string, unitType: UnitTypeKey, x: number, y: number): UnitRow {
  return {
    id,
    colony_id: 'attacker',
    unit_type: unitType,
    hp_current: UNIT_TYPES[unitType].baseStats.hp,
    tier: 1,
    upgrade_path: [],
    grid_x: String(x),
    grid_y: String(y),
  }
}

function rowToSimUnit(source: UnitRow): SimUnit {
  const id = source.id
  if (!id) throw new Error('External-ID micro fixture requires row IDs')
  const team = source.colony_id === 'defender' ? 'defender' : 'attacker'
  const unit = createRuntimeUnitFromConfig({
    id,
    team,
    type: source.unit_type,
    x: Number(source.grid_x),
    y: Number(source.grid_y),
    hp: source.hp_current,
    currentAngle: source.colony_id === 'attacker' ? 0 : Math.PI,
  })
  if (!unit) throw new Error(`Unable to compile ${source.id}`)
  return unit
}

function initiativeScenario(): CombatBalanceScenario {
  return {
    id: 'external-id-initiative',
    name: 'External ID initiative',
    attackers: [row('unit-charlie', 'light_walker', 100, 200), row('unit-alpha', 'gravity_manipulator', 200, 200), row('unit-bravo', 'engineer', 300, 200)],
    defenders: [],
  }
}

function targetTieScenario(): CombatBalanceScenario {
  return {
    id: 'external-id-target-tie',
    name: 'External ID target tie',
    attackers: [row('tie-attacker', 'light_walker', 300, 300)],
    defenders: [
      { ...row('target-left', 'light_walker', 240, 420), colony_id: 'defender', hp_current: 1000 },
      { ...row('target-right', 'light_walker', 360, 420), colony_id: 'defender', hp_current: 1000 },
    ],
  }
}

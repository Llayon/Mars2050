import type { BattleAction } from '../../combat.actions'
import type {
  PercentHpDamageConfig,
  PeriodicAbilityPayload,
} from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { grantShield } from '../defense-resource-commit'
import { applyEcsSingleDamage } from './damage-system'
import { resolveEcsDeath } from './death-system'
import { applyEcsHealing } from './healing-system'
import { applyEcsStatus } from './status-application-system'
import { cleanseEcsStatuses } from './trigger-field-system'
import { spawnEcsPeriodicUnits } from './periodic-ability-spawn-system'

export function applyEcsPeriodicAbilityPayload(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: PeriodicAbilityPayload,
  abilityId: string,
  tick: number,
  actions: BattleAction[],
): void {
  if (payload.kind === 'hazard') {
    createHazard(world, sourceId, targetId, payload, abilityId, tick, actions)
  } else if (payload.kind === 'shield') {
    applyShield(world, sourceId, targetId, payload.amount, actions)
  } else if (payload.kind === 'spawn') {
    spawnEcsPeriodicUnits(
      world,
      sourceId,
      targetId,
      payload,
      abilityId,
      actions,
    )
  } else {
    for (const [targetOrdinal, payloadTargetId] of getPayloadTargets(
      world,
      sourceId,
      targetId,
      payload,
    ).entries()) {
      if (payload.kind === 'damage') {
        applyDamage(world, sourceId, payloadTargetId, payload, actions, abilityId, targetOrdinal)
      } else if (payload.kind === 'status') {
        for (const status of payload.effects) {
          applyEcsStatus(world, payloadTargetId, {
            ...status,
            sourceUnitId: getExternalId(world, sourceId),
          }, actions)
        }
      } else if (payload.kind === 'heal') {
        applyHeal(world, sourceId, payloadTargetId, payload, actions)
      } else if (payload.kind === 'mark') {
        applyMark(world, sourceId, payloadTargetId, payload.mark, actions)
      }
    }
  }
}

function applyDamage(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: Extract<PeriodicAbilityPayload, { kind: 'damage' }>,
  actions: BattleAction[],
  abilityId: string,
  targetOrdinal: number,
): void {
  const percentDamage = getPercentDamage(world, targetId, payload.percentHp)
  if (percentDamage > 0) {
    actions.push({
      unitId: getExternalId(world, sourceId),
      type: 'percent_hp_damage',
      targetId: getExternalId(world, targetId),
      value: percentDamage,
    })
  }
  const result = applyEcsSingleDamage(
    world,
    sourceId,
    targetId,
    Math.max(0, Math.floor(payload.amount ?? 0)) + percentDamage,
    actions,
    { allowPercentHpDamage: false, deathCause: 'weapon', originExternalId: `ability:${abilityId}`, authoredOrdinal: targetOrdinal },
  )
  if (result.intercepted) return
  resolveEcsDeath(world, targetId, sourceId, actions, 'weapon')
  flushStructuralChanges(world)
  for (const status of payload.statusEffects ?? []) {
    applyEcsStatus(world, targetId, {
      ...status,
      sourceUnitId: getExternalId(world, sourceId),
    }, actions)
  }
}

function createHazard(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: Extract<PeriodicAbilityPayload, { kind: 'hazard' }>,
  abilityId: string,
  tick: number,
  actions: BattleAction[],
): void {
  const source = world.stores.identity.require(sourceId)
  const target = world.stores.transform.require(targetId)
  world.queueHazardCreation({
    id: world.preferExternalId(`periodic_${source.id}_${abilityId}_${tick}`),
    team: source.team,
    type: payload.hazardType,
    x: target.x,
    y: target.y,
    radius: payload.radius,
    damagePerTick: payload.damagePerTick ?? 0,
    duration: payload.duration,
    statusEffects: payload.statusEffects?.map(status => ({ ...status })),
    sourceUnitId: source.id,
  })
  actions.push({
    unitId: source.id,
    type: 'hazard_spawn',
    targetId: getExternalId(world, targetId),
    statusType: payload.hazardType,
    radius: payload.radius,
  })
}

function applyShield(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  amount: number,
  actions: BattleAction[],
): void {
  const granted = Math.max(0, Math.floor(amount))
    grantShield(world, targetId, granted)
  actions.push({
    unitId: getExternalId(world, sourceId),
    type: 'shield_apply',
    targetId: getExternalId(world, targetId),
    damage: granted,
  })
}

function applyHeal(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: Extract<PeriodicAbilityPayload, { kind: 'heal' }>,
  actions: BattleAction[],
): void {
  const vitality = world.stores.vitality.require(targetId)
  const amount = payload.amount !== undefined
    ? Math.max(0, Math.floor(payload.amount))
    : Math.max(1, Math.floor(vitality.maxHp * (payload.percentMaxHp ?? 0)))
  applyEcsHealing(world, sourceId, targetId, amount, actions)
  if (payload.cleanse) {
    cleanseEcsStatuses(world, targetId, payload.cleanse, actions)
  }
}

function applyMark(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  mark: Extract<PeriodicAbilityPayload, { kind: 'mark' }>['mark'],
  actions: BattleAction[],
): void {
  if (world.stores.vitality.require(targetId).isDead) return
  const sourceExternalId = getExternalId(world, sourceId)
  world.stores.statusControl.require(targetId).targetMark = {
    ...mark,
    sourceUnitId: sourceExternalId,
  }
  world.stores.entitySources.require(targetId).targetMarkSource = sourceId
  actions.push({
    unitId: sourceExternalId,
    type: 'target_mark',
    targetId: getExternalId(world, targetId),
    value: mark.damageMultiplier ??
      mark.executeThreshold ??
      mark.focusPriority,
  })
}

function getPayloadTargets(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  payload: Exclude<PeriodicAbilityPayload, { kind: 'hazard' | 'shield' | 'spawn' }>,
): EntityId[] {
  if (payload.kind === 'status' || payload.radius === undefined) {
    return [targetId]
  }
  const centerId = payload.kind === 'heal' ? sourceId : targetId
  const center = world.stores.transform.require(centerId)
  const sourceTeam = world.stores.identity.require(sourceId).team
  return world.resources.require('entitySpatial')
    .query(world, center.x, center.y, payload.radius)
    .filter(entityId => {
      const identity = world.stores.identity.require(entityId)
      const transform = world.stores.transform.require(entityId)
      const sameTeam = identity.team === sourceTeam
      return (payload.kind === 'heal' ? sameTeam : !sameTeam) &&
        getDistance(center.x, center.y, transform.x, transform.y) <= payload.radius!
    })
    .sort((left, right) =>
      getExternalId(world, left).localeCompare(getExternalId(world, right)),
    )
}

function getPercentDamage(
  world: CombatWorld,
  targetId: EntityId,
  config: PercentHpDamageConfig | undefined,
): number {
  if (!config) return 0
  const vitality = world.stores.vitality.require(targetId)
  const basis = (config.basis ?? 'max') === 'current'
    ? vitality.hp
    : vitality.maxHp
  let damage = Math.max(0, Math.floor(basis * config.percent))
  if (config.minBonus !== undefined) damage = Math.max(damage, Math.floor(config.minBonus))
  if (config.maxBonus !== undefined) damage = Math.min(damage, Math.floor(config.maxBonus))
  return Math.max(0, damage)
}

function flushStructuralChanges(world: CombatWorld): void {
  world.flushStructuralCommands()
  world.resources.require('entitySpatial').ensureCurrent(world)
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}

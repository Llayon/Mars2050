import type { BattleAction } from '../../combat.actions'
import { HARMFUL_STATUS_TYPES } from '../../combat.status-core'
import type { StatusType, SupportAura } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import { getEcsCombatTags } from '../targeting-evaluation'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'
import { cleanseEcsStatuses } from './trigger-field-system'
import { getAbilityExecutionMode } from './ability-effect-system'
import { setShield, setShieldCapacity } from '../defense-resource-commit'

const DEFAULT_AURA_INTERVAL = 10

export function getEcsSupportAuraEntities(world: CombatWorld): readonly EntityId[] {
  return world.query([
    'identity',
    'transform',
    'vitality',
    'support',
    'supportAuraCapability',
  ])
}

export function hasEcsSupportAuraAtTick(
  world: CombatWorld,
  tick: number,
  entityIds = getEcsSupportAuraEntities(world),
): boolean {
  return entityIds.some(entityId => getAurasAtTick(world, entityId, tick).length > 0)
}

export function runEcsSupportAuraSystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsSupportAuraEntities(world),
): void {
  const sources = [...entityIds].sort((left, right) =>
    getExternalId(world, left).localeCompare(getExternalId(world, right)),
  )
  for (const sourceId of sources) {
    if (world.stores.vitality.require(sourceId).isDead) continue
    for (const aura of getAurasAtTick(world, sourceId, tick)) {
      for (const targetId of getTargets(world, sourceId, aura)) {
        applyAura(world, sourceId, targetId, aura, actions)
      }
    }
  }
}

function getAurasAtTick(world: CombatWorld, sourceId: EntityId, tick: number): SupportAura[] {
  const support = world.stores.support.require(sourceId)
  const compiled = getAbilityExecutionMode(world, sourceId) === 'compiled'
  if (!compiled) return (support.supportAuras ?? []).filter(aura => {
    const interval = aura.interval ?? DEFAULT_AURA_INTERVAL
    return interval <= 1 || tick % interval === 0
  })
  const auras: SupportAura[] = []
  for (const program of support.supportPrograms ?? []) {
    if (program.trigger.kind !== 'periodic') continue
    if (program.trigger.intervalTicks > 1 && tick % program.trigger.intervalTicks !== 0) continue
    for (const group of program.groups) {
      for (const effect of group.effects) {
        if (effect.kind === 'support_aura') auras.push(effect.aura)
      }
    }
  }
  return auras
}

function getTargets(
  world: CombatWorld,
  sourceId: EntityId,
  aura: SupportAura,
): EntityId[] {
  const sourceIdentity = world.stores.identity.require(sourceId)
  const source = world.stores.transform.require(sourceId)
  return world.resources.require('entitySpatial')
    .query(world, source.x, source.y, aura.radius)
    .filter(targetId => {
      if (targetId === sourceId) return false
      const targetIdentity = world.stores.identity.require(targetId)
      const target = world.stores.transform.require(targetId)
      if (aura.target === 'allies' &&
          targetIdentity.team !== sourceIdentity.team) return false
      if (aura.target === 'enemies' &&
          targetIdentity.team === sourceIdentity.team) return false
      if (!matchesTags(world, targetId, aura)) return false
      return getDistance(source.x, source.y, target.x, target.y) <= aura.radius
    })
    .sort((left, right) =>
      getExternalId(world, left).localeCompare(getExternalId(world, right)),
    )
}

function matchesTags(
  world: CombatWorld,
  targetId: EntityId,
  aura: SupportAura,
): boolean {
  if (!aura.targetTags?.length) return true
  const tags = new Set(getEcsCombatTags(world, targetId))
  return aura.targetTags.some(tag => tags.has(tag))
}

function applyAura(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  aura: SupportAura,
  actions: BattleAction[],
): void {
  if (aura.type === 'shield' || aura.type === 'shield_repair') {
    applyShieldAura(world, sourceId, targetId, aura, actions)
    return
  }
  if (aura.type === 'cleanse') {
    cleanseEcsStatuses(world, targetId, HARMFUL_STATUS_TYPES, actions)
    return
  }
  const statusType = getAuraStatusType(aura.type)
  if (!statusType) return
  applyEcsStatus(world, targetId, {
    type: statusType,
    duration: aura.duration ??
      (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
    value: aura.type === 'reveal' || aura.type === 'status_immunity'
      ? undefined
      : aura.value,
    sourceUnitId: getExternalId(world, sourceId),
  }, actions)
}

function applyShieldAura(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  aura: SupportAura,
  actions: BattleAction[],
): void {
  const vitality = world.stores.vitality.require(targetId)
  let granted = 0
  if (aura.type === 'shield') {
    const cap = Math.max(0, Math.floor(aura.value))
    if (cap <= 0 || vitality.shield >= cap) return
    granted = cap - vitality.shield
    setShieldCapacity(world, targetId, Math.max(vitality.maxShield, cap))
    setShield(world, targetId, cap)
  } else {
    const repair = Math.max(0, Math.floor(aura.value))
    if (repair <= 0 ||
        vitality.maxShield <= 0 ||
        vitality.shield >= vitality.maxShield) return
    granted = Math.min(repair, vitality.maxShield - vitality.shield)
    setShield(world, targetId, vitality.shield + granted)
  }
  actions.push({
    unitId: getExternalId(world, sourceId),
    type: 'shield_apply',
    targetId: getExternalId(world, targetId),
    damage: granted,
  })
}

function getAuraStatusType(type: SupportAura['type']): StatusType | null {
  if (type === 'reveal') return 'revealed'
  if (type === 'regen' ||
      type === 'status_immunity' ||
      type === 'haste' ||
      type === 'range_boost' ||
      type === 'attack_boost' ||
      type === 'damage_reduction') return type
  return null
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}

import type { BattleAction } from '../combat.actions'
import type { EcsActionGroupLedger } from '../combat.action-intent'
import type { DeathCause } from '../combat.death.types'
import { compareDamageOrder, resolveDefenseBatch, type DamageOrderKey } from './defense-batch'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import type { Team } from '../combat.sim.types'
import type { DamageAttribution } from './damage-source'
import { breakBarrier, grantBarrier, grantShield, increaseShieldCapacity, setBarrierCapacity, setReactiveArmorCharges, setShield, setShieldHitBlockCharges } from './defense-resource-commit'
import { resolveEcsDeath } from './systems/death-system'
import { applyEcsStatus } from './systems/status-application-system'
import { applyEcsCapturedTargetMark } from './systems/target-mark-system'
import { recordEcsResolvedDamageTakenTriggers } from './systems/post-hit-trigger-system'

/** Resolve the immutable V9 frame and translate the pure result into V8 ledger entries. */
export function commitV9DefenseBatch(world: CombatWorld, ledger: EcsActionGroupLedger, actions: BattleAction[]): Set<EntityId> {
  if (!ledger.frame) return new Set()
  ledger.assertRoutingIntact(world)
  const resolution = resolveDefenseBatch(ledger.frame.defense, ledger.claims)
  ledger.resolution = resolution
  const affected = new Set<EntityId>()
  for (const [externalId, shield] of resolution.shieldByExternalId) {
    const entityId = ledger.frame.routing.entityByExternalId.get(externalId)
    if (entityId !== undefined) setShield(world, entityId, shield)
  }
  for (const [externalId, charges] of resolution.shieldHitBlockChargesByExternalId) {
    const entityId = ledger.frame.routing.entityByExternalId.get(externalId)
    if (entityId !== undefined) setShieldHitBlockCharges(world, entityId, charges)
  }
  for (const [externalId, charges] of resolution.reactiveArmorChargesByExternalId) {
    const entityId = ledger.frame.routing.entityByExternalId.get(externalId)
    if (entityId !== undefined) setReactiveArmorCharges(world, entityId, charges)
  }
  for (const [externalId, capacity] of resolution.barrierCapacityByExternalId) {
    const entityId = ledger.frame.routing.barrierEntityByExternalId.get(externalId)
    if (entityId !== undefined) setBarrierCapacity(world, entityId, capacity)
  }
  for (const result of resolution.claims) {
    const targetId = ledger.frame.routing.entityByExternalId.get(result.targetExternalId)
    if (targetId !== undefined && result.hpDamage > 0) {
      affected.add(targetId)
      const attribution = getResolvedAttribution(ledger, result.sourceExternalId, result.claim.sourceUnitType, result.claim.sourceTeam)
      ledger.queueDamage(targetId, attribution, result.hpDamage, result.claim.deathCause as import('../combat.death.types').DeathCause | undefined)
      ledger.resolvedDamageTaken.push({ targetExternalId: result.targetExternalId, damage: result.hpDamage, ...attribution })
    }
    for (const shared of result.sharedDamageEvents) {
      const sharedId = ledger.frame.routing.entityByExternalId.get(shared.targetExternalId)
      if (sharedId !== undefined) {
        affected.add(sharedId)
        const attribution = getResolvedAttribution(ledger, result.sourceExternalId, result.claim.sourceUnitType, result.claim.sourceTeam)
        ledger.queueDamage(sharedId, attribution, shared.damage, result.claim.deathCause as import('../combat.death.types').DeathCause | undefined)
        ledger.resolvedDamageTaken.push({ targetExternalId: shared.targetExternalId, damage: shared.damage, ...attribution })
      }
    }
    emitV9Actions(ledger, result, actions)
    for (const barrierId of result.barrierBreaks) ledger.barrierBreaks.add(barrierId)
  }
  for (const intent of resolution.healingIntents) {
    const targetId = ledger.frame.routing.entityByExternalId.get(intent.targetExternalId)
    if (targetId !== undefined) {
      affected.add(targetId)
      ledger.queueHealing(targetId, intent.sourceExternalId, intent.amount, 'lifesteal')
    }
  }
  return affected
}

/** Completes a V9 group, including projection, effects and simultaneous death resolution. */
export function commitV9ResolutionGroup(world: CombatWorld, ledger: EcsActionGroupLedger, actions: BattleAction[]): Set<EntityId> {
  if (!ledger.frame) return new Set()
  let affected: Set<EntityId>
  try {
    affected = ledger.claims.length > 0
      ? commitV9DefenseBatch(world, ledger, actions)
      : new Set<EntityId>([...ledger.damage.keys(), ...ledger.healing.keys()])
  } catch (error) {
    ledger.finish()
    throw error
  }

  for (const entityId of [...ledger.damage.keys(), ...ledger.healing.keys(), ...ledger.forcedDeaths.keys()]) {
    affected.add(entityId)
  }

  ledger.committing = true
  try {
    for (const grant of [...ledger.defenseGrants].sort((left, right) =>
      left.sourceExternalId < right.sourceExternalId ? -1 : left.sourceExternalId > right.sourceExternalId ? 1 :
        left.kind < right.kind ? -1 : left.kind > right.kind ? 1 :
          (world.stores.entityMeta.require(left.targetId).externalId < world.stores.entityMeta.require(right.targetId).externalId ? -1 : 1))) {
      if (grant.kind === 'shield') grantShield(world, grant.targetId, grant.amount)
      else if (grant.kind === 'shield_capacity') increaseShieldCapacity(world, grant.targetId, grant.amount)
      else grantBarrier(world, grant.targetId, grant.amount)
    }

    for (const entityId of affected) {
      const vitality = world.stores.vitality.require(entityId)
      if (ledger.forcedDeaths.has(entityId)) {
        vitality.hp = 0
        continue
      }
      const startHp = ledger.startHp.get(entityId) ?? vitality.hp
      const healing = (ledger.healing.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
      const damage = (ledger.damage.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
      vitality.hp = Math.max(0, Math.min(vitality.maxHp, startHp + healing - damage))
      emitGroupHealing(world, entityId, ledger, actions, damage)
    }

    for (const pending of [...ledger.statuses].sort((left, right) => comparePendingStatus(world, left, right))) {
      if (ledger.getProjectedHp(world, pending.targetId) > 0 && !world.stores.vitality.require(pending.targetId).isDead) {
        applyEcsStatus(world, pending.targetId, pending.effect, actions, pending.authoredKey, pending.sourceAttribution)
      }
    }
    for (const pending of [...ledger.marks].sort((left, right) => comparePendingMark(world, left, right))) {
      if (ledger.getProjectedHp(world, pending.targetId) > 0 && !world.stores.vitality.require(pending.targetId).isDead) {
        applyEcsCapturedTargetMark(world, pending.attribution, pending.targetId, pending.mark, actions, pending.propagateSquad, pending.authoredKey)
      }
    }
  } finally {
    ledger.committing = false
    ledger.finish()
  }

  emitBarrierLifecycleActions(world, ledger, actions)

  for (const intent of ledger.resolvedDamageTaken) {
    const targetId = ledger.frame.routing.entityByExternalId.get(intent.targetExternalId)
    if (targetId === undefined) continue
    recordEcsResolvedDamageTakenTriggers(world, targetId, {
      sourceExternalId: intent.sourceExternalId,
      sourceEntityId: intent.sourceEntityId,
      sourceUnitType: intent.sourceUnitType,
      sourceTeam: intent.sourceTeam,
    }, intent.damage, actions)
  }

  const deaths = [...affected]
    .filter(entityId => !world.stores.vitality.require(entityId).isDead && world.stores.vitality.require(entityId).hp <= 0)
    .sort((left, right) => world.stores.identity.require(left).id < world.stores.identity.require(right).id ? -1 : world.stores.identity.require(left).id > world.stores.identity.require(right).id ? 1 : 0)
  for (const entityId of deaths) world.setEntityDead(entityId, true)
  for (const entityId of deaths) {
    const forced = ledger.forcedDeaths.get(entityId)
    const pending = [...(ledger.damage.get(entityId) ?? [])]
      .sort((left, right) => right.amount - left.amount || (left.attribution.sourceExternalId < right.attribution.sourceExternalId ? -1 : left.attribution.sourceExternalId > right.attribution.sourceExternalId ? 1 : 0))[0]
    resolveEcsDeath(
      world,
      entityId,
      forced?.source ?? pending?.attribution,
      actions,
      forced?.cause ?? (pending?.cause ?? 'weapon') as DeathCause,
      { preMarked: true },
    )
    world.stores.vitality.require(entityId).hp = 0
  }
  return affected
}

function getResolvedAttribution(ledger: EcsActionGroupLedger, sourceExternalId: string, sourceUnitType?: string, sourceTeam?: Team): DamageAttribution {
  return {
    sourceExternalId,
    ...(ledger.frame?.routing.entityByExternalId.has(sourceExternalId) ? { sourceEntityId: ledger.frame.routing.entityByExternalId.get(sourceExternalId) } : {}),
    ...(sourceUnitType ? { sourceUnitType } : {}),
    ...(sourceTeam ? { sourceTeam } : {}),
  }
}

function emitBarrierLifecycleActions(world: CombatWorld, ledger: EcsActionGroupLedger, actions: BattleAction[]): void {
  const barrierIds = new Set([...ledger.barrierBreaks, ...ledger.barrierExpirations])
  for (const barrierId of [...barrierIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)) {
    const barrierEntityId = ledger.frame?.routing.barrierEntityByExternalId.get(barrierId)
    if (barrierEntityId === undefined) continue
    const barrier = ledger.frame?.defense.barriersByExternalId.get(barrierId)
    if (ledger.barrierBreaks.has(barrierId)) {
      breakBarrier(world, barrierEntityId)
      world.structuralCommands.queueHazardRemoval(barrierEntityId)
      actions.push({ unitId: barrier?.sourceExternalId ?? barrierId, type: 'barrier_break', hazardId: barrierId })
      continue
    }
    actions.push({ unitId: barrier?.sourceExternalId ?? barrierId, type: 'barrier_expire', hazardId: barrierId })
    world.structuralCommands.queueHazardRemoval(barrierEntityId)
  }
}

function emitGroupHealing(world: CombatWorld, targetId: EntityId, ledger: EcsActionGroupLedger, actions: BattleAction[], damage: number): void {
  const entries = [...(ledger.healing.get(targetId) ?? [])]
  if (entries.length === 0) return
  const vitality = world.stores.vitality.require(targetId)
  const startHp = ledger.startHp.get(targetId) ?? vitality.hp
  let remaining = Math.max(0, Math.min(
    entries.reduce((sum, entry) => sum + entry.amount, 0),
    vitality.maxHp - startHp + damage,
  ))
  for (const entry of entries.sort((left, right) => left.sourceExternalId < right.sourceExternalId ? -1 : left.sourceExternalId > right.sourceExternalId ? 1 : 0)) {
    const actual = Math.min(remaining, entry.amount)
    if (actual > 0 && entry.kind !== 'lifesteal') actions.push({ unitId: entry.sourceExternalId, type: 'heal', targetId: world.stores.identity.require(targetId).id, damage: actual })
    remaining -= actual
  }
}

function emitV9Actions(ledger: EcsActionGroupLedger, result: ReturnType<typeof resolveDefenseBatch>['claims'][number], actions: BattleAction[]): void {
  const target = result.targetExternalId
  const source = result.sourceExternalId
  const claim = result.claim
  const metadata = {
    ...(claim.sourceUnitType ? { sourceUnitType: claim.sourceUnitType } : {}),
    ...(claim.sourceTeam ? { sourceTeam: claim.sourceTeam } : {}),
    ...(claim.hazardId ? { hazardId: claim.hazardId } : {}),
    ...(claim.statusType ? { statusType: claim.statusType } : {}),
    ...(claim.damageKind ? { damageKind: claim.damageKind } : {}),
    ...(claim.deathCause ? { cause: claim.deathCause } : {}),
    ...(claim.impactId !== undefined ? { impactId: claim.impactId } : {}),
  }
  const nonShieldBlocked = result.blockedDamage
  if (result.barrierBlockedDamage > 0) actions.push({ unitId: target, type: 'barrier_absorb', targetId: source, damage: result.barrierBlockedDamage, ...metadata })
  if (result.shieldDamage > 0) actions.push({ unitId: source, type: 'shield_damage', targetId: target, damage: result.shieldDamage, isShieldHit: true, ...metadata })
  if (result.shieldBroken) actions.push({ unitId: source, type: 'shield_break', targetId: target, ...metadata })
  if (result.shieldHitBlock) actions.push({ unitId: target, type: 'shield_hit_block', targetId: source, damage: result.shieldHitBlockedDamage, ...metadata })
  if (nonShieldBlocked > 0) actions.push({ unitId: target, type: 'unit_blocked_damage', targetId: source, damage: nonShieldBlocked, ...metadata })
  if (result.hpDamage > 0) actions.push({ unitId: source, type: 'damage', targetId: target, damage: result.hpDamage, ...(result.bonusDamage > 0 ? { bonusDamage: result.bonusDamage } : {}), ...metadata })
  for (const shared of result.sharedDamageEvents) actions.push({ unitId: source, type: 'damage_share', targetId: shared.targetExternalId, damage: shared.damage, ...metadata })
  if (result.lifesteal > 0) actions.push({ unitId: source, type: 'lifesteal', targetId: source, damage: result.lifesteal, ...metadata })
}

function comparePendingStatus(world: CombatWorld, left: EcsActionGroupLedger['statuses'][number], right: EcsActionGroupLedger['statuses'][number]): number {
  return compareDamageOrder(left.authoredKey ?? legacyPendingKey(world, left.targetId, left.effect.sourceUnitId ?? left.effect.type), right.authoredKey ?? legacyPendingKey(world, right.targetId, right.effect.sourceUnitId ?? right.effect.type))
}

function comparePendingMark(world: CombatWorld, left: EcsActionGroupLedger['marks'][number], right: EcsActionGroupLedger['marks'][number]): number {
  return compareDamageOrder(left.authoredKey ?? legacyPendingKey(world, left.targetId, left.attribution.sourceExternalId), right.authoredKey ?? legacyPendingKey(world, right.targetId, right.attribution.sourceExternalId))
}

function legacyPendingKey(world: CombatWorld, targetId: EntityId, sourceExternalId: string): DamageOrderKey {
  return {
    originExternalId: `pending:${sourceExternalId}`,
    position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
    authoredOrdinal: 0,
    targetExternalId: world.stores.identity.require(targetId).id,
    sourceExternalId,
  }
}

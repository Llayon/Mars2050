import type { BattleAction } from '../combat.actions'
import type { EcsActionGroupLedger } from '../combat.action-intent'
import type { DeathCause } from '../combat.death.types'
import { resolveDefenseBatch } from './defense-batch'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { breakBarrier, grantBarrier, grantShield, increaseShieldCapacity, setBarrierCapacity, setReactiveArmorCharges, setShield, setShieldHitBlockCharges } from './defense-resource-commit'
import { resolveEcsDeath } from './systems/death-system'
import { applyEcsStatus } from './systems/status-application-system'
import { applyEcsCapturedTargetMark } from './systems/target-mark-system'

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
      ledger.queueDamage(targetId, {
        sourceExternalId: result.sourceExternalId,
        ...(ledger.frame.routing.entityByExternalId.has(result.sourceExternalId) ? { sourceEntityId: ledger.frame.routing.entityByExternalId.get(result.sourceExternalId) } : {}),
        ...(result.claim.sourceUnitType ? { sourceUnitType: result.claim.sourceUnitType } : {}),
        ...(result.claim.sourceTeam ? { sourceTeam: result.claim.sourceTeam } : {}),
      }, result.hpDamage, result.claim.deathCause as import('../combat.death.types').DeathCause | undefined)
    }
    for (const shared of result.sharedDamageEvents) {
      const sharedId = ledger.frame.routing.entityByExternalId.get(shared.targetExternalId)
      if (sharedId !== undefined) {
        affected.add(sharedId)
        ledger.queueDamage(sharedId, {
          sourceExternalId: result.sourceExternalId,
          ...(ledger.frame.routing.entityByExternalId.has(result.sourceExternalId) ? { sourceEntityId: ledger.frame.routing.entityByExternalId.get(result.sourceExternalId) } : {}),
          ...(result.claim.sourceUnitType ? { sourceUnitType: result.claim.sourceUnitType } : {}),
          ...(result.claim.sourceTeam ? { sourceTeam: result.claim.sourceTeam } : {}),
        }, shared.damage, result.claim.deathCause as import('../combat.death.types').DeathCause | undefined)
      }
    }
    emitV9Actions(ledger, result, actions)
    for (const barrierId of result.barrierBreaks) {
      const entityId = ledger.frame.routing.barrierEntityByExternalId.get(barrierId)
      if (entityId !== undefined) breakBarrier(world, entityId)
    }
  }
  for (const intent of resolution.healingIntents) {
    const targetId = ledger.frame.routing.entityByExternalId.get(intent.targetExternalId)
    if (targetId !== undefined) {
      affected.add(targetId)
      ledger.queueHealing(targetId, intent.sourceExternalId, intent.amount)
    }
  }
  return affected
}

/** Completes a V9 group, including projection, effects and simultaneous death resolution. */
export function commitV9ResolutionGroup(world: CombatWorld, ledger: EcsActionGroupLedger, actions: BattleAction[]): Set<EntityId> {
  if (!ledger.frame) return new Set()
  const affected = ledger.claims.length > 0
    ? commitV9DefenseBatch(world, ledger, actions)
    : new Set<EntityId>([...ledger.damage.keys(), ...ledger.healing.keys()])

  ledger.committing = true
  for (const grant of [...ledger.defenseGrants].sort((left, right) =>
    left.sourceExternalId < right.sourceExternalId ? -1 : left.sourceExternalId > right.sourceExternalId ? 1 :
      left.kind.localeCompare(right.kind) ||
      (world.stores.entityMeta.require(left.targetId).externalId < world.stores.entityMeta.require(right.targetId).externalId ? -1 : 1))) {
    if (grant.kind === 'shield') grantShield(world, grant.targetId, grant.amount)
    else if (grant.kind === 'shield_capacity') increaseShieldCapacity(world, grant.targetId, grant.amount)
    else grantBarrier(world, grant.targetId, grant.amount)
  }

  for (const entityId of affected) {
    const vitality = world.stores.vitality.require(entityId)
    const startHp = ledger.startHp.get(entityId) ?? vitality.hp
    const healing = (ledger.healing.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
    const damage = (ledger.damage.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
    vitality.hp = Math.max(0, Math.min(vitality.maxHp, startHp + healing - damage))
    emitGroupHealing(world, entityId, ledger, actions, damage)
  }

  for (const pending of [...ledger.statuses].sort((left, right) =>
    world.stores.identity.require(left.targetId).id.localeCompare(world.stores.identity.require(right.targetId).id))) {
    if (ledger.getProjectedHp(world, pending.targetId) > 0 && !world.stores.vitality.require(pending.targetId).isDead) {
      applyEcsStatus(world, pending.targetId, pending.effect, actions)
    }
  }
  for (const pending of [...ledger.marks].sort((left, right) =>
    left.attribution.sourceExternalId < right.attribution.sourceExternalId ? -1 : left.attribution.sourceExternalId > right.attribution.sourceExternalId ? 1 :
      world.stores.identity.require(left.targetId).id.localeCompare(world.stores.identity.require(right.targetId).id))) {
    if (ledger.getProjectedHp(world, pending.targetId) > 0 && !world.stores.vitality.require(pending.targetId).isDead) {
      applyEcsCapturedTargetMark(world, pending.attribution, pending.targetId, pending.mark, actions)
    }
  }
  ledger.committing = false
  ledger.finish()

  const forcedEntries = [...ledger.forcedDeaths.entries()]
  for (const [entityId] of forcedEntries) {
    world.stores.vitality.require(entityId).hp = 0
    affected.add(entityId)
  }
  const deaths = [...affected]
    .filter(entityId => !world.stores.vitality.require(entityId).isDead && world.stores.vitality.require(entityId).hp <= 0)
    .sort((left, right) => world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id))
  for (const [entityId] of forcedEntries) {
    if (!world.stores.vitality.require(entityId).isDead) world.setEntityDead(entityId, true)
  }
  for (const entityId of deaths) world.setEntityDead(entityId, true)
  for (const [entityId, forced] of forcedEntries) {
    resolveEcsDeath(world, entityId, forced.source, actions, forced.cause, { preMarked: true })
  }
  for (const entityId of deaths) {
    const pending = [...(ledger.damage.get(entityId) ?? [])]
      .sort((left, right) => right.amount - left.amount || left.attribution.sourceExternalId.localeCompare(right.attribution.sourceExternalId))[0]
    resolveEcsDeath(
      world,
      entityId,
      pending?.attribution,
      actions,
      (pending?.cause ?? 'weapon') as DeathCause,
      { preMarked: true },
    )
    world.stores.vitality.require(entityId).hp = 0
  }
  return affected
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
  for (const entry of entries.sort((left, right) => left.sourceExternalId.localeCompare(right.sourceExternalId))) {
    const actual = Math.min(remaining, entry.amount)
    if (actual > 0) actions.push({ unitId: entry.sourceExternalId, type: 'heal', targetId: world.stores.identity.require(targetId).id, damage: actual })
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
  const shieldOverflowBlocked = result.shieldHitBlockedDamage
  const nonShieldBlocked = Math.max(0, result.blockedDamage - shieldOverflowBlocked - result.reactiveArmorBlockedDamage - result.barrierBlockedDamage)
  if (result.barrierBlockedDamage > 0) actions.push({ unitId: target, type: 'barrier_absorb', targetId: source, damage: result.barrierBlockedDamage, ...metadata })
  for (const barrierId of result.barrierBreaks) {
    const owner = ledger.frame?.defense.barriersByExternalId.get(barrierId)?.sourceExternalId ?? source
    actions.push({ unitId: owner, type: 'barrier_break', hazardId: barrierId, ...metadata })
  }
  if (result.shieldDamage > 0) actions.push({ unitId: source, type: 'shield_damage', targetId: target, damage: result.shieldDamage, isShieldHit: true, ...metadata })
  if (result.shieldBroken) actions.push({ unitId: source, type: 'shield_break', targetId: target, ...metadata })
  if (result.shieldHitBlock) actions.push({ unitId: target, type: 'shield_hit_block', targetId: source, damage: shieldOverflowBlocked, ...metadata })
  if (nonShieldBlocked > 0) actions.push({ unitId: target, type: 'unit_blocked_damage', targetId: source, damage: nonShieldBlocked, ...metadata })
  if (result.hpDamage > 0) actions.push({ unitId: source, type: 'damage', targetId: target, damage: result.hpDamage, ...(result.bonusDamage > 0 ? { bonusDamage: result.bonusDamage } : {}), ...metadata })
  for (const shared of result.sharedDamageEvents) actions.push({ unitId: source, type: 'damage_share', targetId: shared.targetExternalId, damage: shared.damage, ...metadata })
  if (result.lifesteal > 0) actions.push({ unitId: source, type: 'lifesteal', targetId: source, damage: result.lifesteal, ...metadata })
}

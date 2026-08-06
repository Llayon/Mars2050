import type { BattleAction } from '../combat.actions'
import type { EcsActionGroupLedger } from '../combat.action-intent'
import { resolveDefenseBatch } from './defense-batch'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { breakBarrier, setBarrierCapacity, setReactiveArmorCharges, setShield, setShieldHitBlockCharges } from './defense-resource-commit'

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
    emitV9Actions(world, result, actions)
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

function emitV9Actions(world: CombatWorld, result: ReturnType<typeof resolveDefenseBatch>['claims'][number], actions: BattleAction[]): void {
  const targetId = world.getEntityId(result.targetExternalId)
  if (targetId === undefined) return
  const target = result.targetExternalId
  const source = result.sourceExternalId
  if (result.barrierBlockedDamage > 0) actions.push({ unitId: target, type: 'barrier_absorb', targetId: source, damage: result.barrierBlockedDamage })
  for (const barrierId of result.barrierBreaks) actions.push({ unitId: source, type: 'barrier_break', hazardId: barrierId })
  if (result.shieldDamage > 0) actions.push({ unitId: source, type: 'shield_damage', targetId: target, damage: result.shieldDamage, isShieldHit: true })
  if (result.shieldBroken) actions.push({ unitId: source, type: 'shield_break', targetId: target })
  if (result.shieldHitBlock) actions.push({ unitId: target, type: 'shield_hit_block', targetId: source, damage: result.blockedDamage })
  if (result.blockedDamage > 0) actions.push({ unitId: target, type: 'unit_blocked_damage', targetId: source, damage: result.blockedDamage })
  if (result.hpDamage > 0) actions.push({ unitId: source, type: 'damage', targetId: target, damage: result.hpDamage })
  for (const shared of result.sharedDamageEvents) actions.push({ unitId: source, type: 'damage_share', targetId: shared.targetExternalId, damage: shared.damage })
  if (result.lifesteal > 0) actions.push({ unitId: source, type: 'lifesteal', targetId: source, damage: result.lifesteal })
}

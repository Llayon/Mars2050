import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageAttribution } from '../damage-source'
import { resolveEcsDeath } from './death-system'
import type { BattleAction } from '../../combat.actions'
import type { DeathCause } from '../../combat.death.types'
import { compareEntityExternalIdsForMode } from '../authored-order'

export interface EcsDamageShareResult {
  damage: number
  sharedDamage: number
  events: { targetId: string; damage: number }[]
}

export function applyEcsDamageSharing(
  world: CombatWorld,
  targetId: EntityId,
  attribution: DamageAttribution,
  damage: number,
  actions: BattleAction[],
  deathCause: DeathCause = 'weapon',
): EcsDamageShareResult {
  const defense = world.stores.defense.require(targetId)
  const ratio = Math.max(0, Math.min(0.9, defense.damageShareRatio ?? 0))
  if (damage <= 0 || ratio <= 0 || !defense.damageShareRadius) return { damage, sharedDamage: 0, events: [] }
  const target = world.stores.transform.require(targetId)
  const targetTeam = world.stores.identity.require(targetId).team
  const recipients = world.resources.require('entitySpatial').query(world, target.x, target.y, defense.damageShareRadius)
    .filter(entityId => {
      if (entityId === targetId || world.stores.vitality.require(entityId).isDead || world.stores.identity.require(entityId).team !== targetTeam) return false
      const transform = world.stores.transform.require(entityId)
      return getDistance(transform.x, transform.y, target.x, target.y) <= defense.damageShareRadius!
    })
    .sort((left, right) => compareEntityExternalIdsForMode(world, left, right))
    .slice(0, Math.max(1, defense.damageShareMaxTargets ?? Number.MAX_SAFE_INTEGER))
  if (recipients.length === 0) return { damage, sharedDamage: 0, events: [] }
  const budget = Math.floor(damage * ratio)
  const baseDamage = Math.floor(budget / recipients.length)
  let remainder = budget % recipients.length
  const events: EcsDamageShareResult['events'] = []
  for (const recipientId of recipients) {
    const shared = baseDamage + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    if (shared <= 0) continue
    const actionGroup = world.resources.get('actionGroup')
    if (actionGroup?.active) {
      actionGroup.queueDamage(recipientId, attribution, shared)
    } else {
      world.stores.vitality.require(recipientId).hp -= shared
    }
    events.push({ targetId: world.stores.identity.require(recipientId).id, damage: shared })
    if (!actionGroup?.active) resolveEcsDeath(world, recipientId, attribution, actions, deathCause)
  }
  const sharedDamage = events.reduce((sum, event) => sum + event.damage, 0)
  return { damage: damage - sharedDamage, sharedDamage, events }
}

export function getEcsShareRecipients(world: CombatWorld, targetId: EntityId): EntityId[] {
  const defense = world.stores.defense.require(targetId)
  if (!defense.damageShareRadius || !defense.damageShareRatio) return []
  const target = world.stores.transform.require(targetId)
  const team = world.stores.identity.require(targetId).team
  return world.resources.require('entitySpatial').query(world, target.x, target.y, defense.damageShareRadius)
    .filter(entityId => entityId !== targetId && !world.stores.vitality.require(entityId).isDead && world.stores.identity.require(entityId).team === team)
}

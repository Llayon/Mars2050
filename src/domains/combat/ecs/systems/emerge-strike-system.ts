import type { BattleAction } from '../../combat.actions'
import type { SimUnit } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

type EmergeStrikePayload = NonNullable<SimUnit['emergeStrikePending']>

export function syncEcsBurrowForAction(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
): void {
  const identity = world.stores.identity.require(entityId)
  const movement = world.stores.movement.require(entityId)
  if (!movement.isBurrowed) return
  movement.isBurrowed = false
  const payload = getConfiguredPayload(world, entityId)
  if (payload) {
    world.stores.weapon.require(entityId).emergeStrikePending = payload
    actions.push({
      unitId: identity.id,
      type: 'emerge_strike',
      value: payload.attackMult ?? payload.aoeRadiusAdd,
    })
  }
  actions.push({ unitId: identity.id, type: 'burrow_change', value: 0 })
}

export function getEcsProspectiveEmergeStrike(
  world: CombatWorld,
  entityId: EntityId,
): EmergeStrikePayload | undefined {
  const pending = world.stores.weapon.require(entityId).emergeStrikePending
  if (pending) return pending
  return world.stores.movement.require(entityId).isBurrowed
    ? getConfiguredPayload(world, entityId)
    : undefined
}

export function consumeEcsEmergeStrike(
  world: CombatWorld,
  entityId: EntityId,
): EmergeStrikePayload | undefined {
  const weapon = world.stores.weapon.require(entityId)
  const payload = weapon.emergeStrikePending
  weapon.emergeStrikePending = undefined
  return payload
}

function getConfiguredPayload(
  world: CombatWorld,
  entityId: EntityId,
): EmergeStrikePayload | undefined {
  const config = world.stores.movement.require(entityId).burrowConfig
  const attackMult = config?.emergeAttackMult
  const aoeRadiusAdd = config?.emergeAoeRadiusAdd
  return attackMult || aoeRadiusAdd ? { attackMult, aoeRadiusAdd } : undefined
}

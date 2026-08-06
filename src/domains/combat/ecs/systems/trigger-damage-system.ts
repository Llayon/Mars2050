import type { BattleAction } from '../../combat.actions'
import type {
  PercentHpDamageConfig,
  TriggerPayload,
} from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsSingleDamage } from './damage-system'
import { resolveEcsDeath } from './death-system'
import type { DamageOrderKey } from '../defense-batch'

type DamagePayload = Extract<TriggerPayload, { kind: 'damage' }>

export function applyEcsTriggerDamage(
  world: CombatWorld,
  ownerId: EntityId,
  targetId: EntityId,
  payload: DamagePayload,
  actions: BattleAction[],
  authoredKey?: DamageOrderKey,
): void {
  for (const [targetOrdinal, hitId] of getTargets(world, ownerId, targetId, payload.radius).entries()) {
    const percentDamage = getConfiguredDamage(world, hitId, payload.percentHp)
    if (percentDamage > 0) {
      actions.push({
        unitId: world.stores.identity.require(ownerId).id,
        type: 'percent_hp_damage',
        targetId: world.stores.identity.require(hitId).id,
        value: percentDamage,
      })
    }
    applyEcsSingleDamage(
      world,
      ownerId,
      hitId,
      Math.max(0, Math.floor(payload.amount ?? 0)) + percentDamage,
      actions,
      {
        allowPercentHpDamage: false,
        deathCause: 'trigger',
        interceptable: false,
        originExternalId: authoredKey?.originExternalId ?? `trigger:${world.stores.identity.require(ownerId).id}`,
        authoredOrdinal: targetOrdinal,
        authoredPosition: authoredKey ? { ...authoredKey.position, targetOrdinal } : { programIndex: 0, groupIndex: 0, targetOrdinal, effectIndex: 0 },
      },
    )
    resolveEcsDeath(world, hitId, ownerId, actions, 'trigger')
  }
}

function getTargets(
  world: CombatWorld,
  ownerId: EntityId,
  targetId: EntityId,
  radius: number | undefined,
): EntityId[] {
  if (radius === undefined) return [targetId]
  const target = world.stores.transform.require(targetId)
  const ownerTeam = world.stores.identity.require(ownerId).team
  const spatial = world.resources.get('entitySpatial')
  const candidates = spatial
    ? spatial.query(world, target.x, target.y, radius)
    : world.query(['identity', 'transform', 'vitality'])
  return candidates
    .filter(entityId => {
      if (world.stores.identity.require(entityId).team === ownerTeam) return false
      const candidate = world.stores.transform.require(entityId)
      return getDistance(target.x, target.y, candidate.x, candidate.y) <= radius
    })
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )
}

function getConfiguredDamage(
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
  if (config.minBonus !== undefined) {
    damage = Math.max(damage, Math.floor(config.minBonus))
  }
  if (config.maxBonus !== undefined) {
    damage = Math.min(damage, Math.floor(config.maxBonus))
  }
  return Math.max(0, damage)
}

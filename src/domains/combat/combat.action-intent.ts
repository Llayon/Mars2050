import type { Team } from './combat.sim.types'
import type { DeathCause } from './combat.death.types'
import type { StatusEffect } from './combat.primitives'
import type { EntityId } from './ecs/entity'
import type { CombatWorld } from './ecs/combat-world'

export type EcsActionKind = 'weapon' | 'heal' | 'spawn' | 'mine' | 'smoke'

export interface EcsActionIntent {
  actorId: EntityId
  targetId: EntityId
  initiative: number
  actorExternalId: string
  targetExternalId: string
  team: Team
  kind: EcsActionKind
  sequence: number
}

export interface PendingDamage {
  sourceId: EntityId
  amount: number
}

export interface PendingHealing {
  sourceExternalId: string
  amount: number
}

export interface PendingStatus {
  targetId: EntityId
  effect: StatusEffect
}

export class EcsActionGroupLedger {
  readonly startHp = new Map<EntityId, number>()
  readonly damage = new Map<EntityId, PendingDamage[]>()
  readonly healing = new Map<EntityId, PendingHealing[]>()
  readonly forcedDeaths = new Map<EntityId, { sourceId?: EntityId; cause: DeathCause }>()
  readonly statuses: PendingStatus[] = []
  active = false
  committing = false

  begin(world: CombatWorld, entityIds: readonly EntityId[]): void {
    this.startHp.clear()
    this.damage.clear()
    this.healing.clear()
    this.forcedDeaths.clear()
    this.statuses.length = 0
    this.committing = false
    for (const entityId of entityIds) {
      const vitality = world.stores.vitality.require(entityId)
      if (!vitality.isDead) this.startHp.set(entityId, vitality.hp)
    }
    this.active = true
  }

  queueForcedDeath(targetId: EntityId, sourceId: EntityId | undefined, cause: DeathCause): void {
    this.forcedDeaths.set(targetId, { sourceId, cause })
  }

  queueDamage(targetId: EntityId, sourceId: EntityId, amount: number): void {
    if (amount <= 0) return
    const entries = this.damage.get(targetId) ?? []
    entries.push({ sourceId, amount })
    this.damage.set(targetId, entries)
  }

  queueHealing(targetId: EntityId, sourceExternalId: string, amount: number): void {
    if (amount <= 0) return
    const entries = this.healing.get(targetId) ?? []
    entries.push({ sourceExternalId, amount })
    this.healing.set(targetId, entries)
  }

  queueStatus(targetId: EntityId, effect: StatusEffect): void {
    this.statuses.push({ targetId, effect: { ...effect } })
  }

  finish(): void {
    this.active = false
    this.committing = false
  }
}

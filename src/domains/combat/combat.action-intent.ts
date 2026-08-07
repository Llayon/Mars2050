import type { Team } from './combat.sim.types'
import type { DeathCause } from './combat.death.types'
import type { StatusEffect, TargetMarkConfig } from './combat.primitives'
import type { EntityId } from './ecs/entity'
import type { CombatWorld } from './ecs/combat-world'
import type { DamageAttribution } from './ecs/damage-source'
import type { CombatDefenseFrame, DefenseBatchSnapshot, DefenseRoutingSnapshot, DamageClaim, DamageOrderKey, AuthoredEffectPosition, DefenseBatchResolution } from './ecs/defense-batch'
import { CombatInvariantError } from './ecs/defense-batch'
import { compareDamageOrder } from './ecs/defense-batch'
import { getDistance } from './combat.utils'
import { getEcsCombatTags } from './ecs/targeting-evaluation'

export interface ResolutionGroupKey { readonly tick: number; readonly phaseId: string; readonly groupOrdinal: number }

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
  attribution: DamageAttribution
  amount: number
  cause?: DeathCause
}

export type { CombatDefenseFrame, DefenseBatchSnapshot, DefenseRoutingSnapshot, DamageClaim, DamageOrderKey, AuthoredEffectPosition }

export interface PendingHealing {
  sourceExternalId: string
  amount: number
  kind?: 'lifesteal'
}

export interface PendingStatus {
  targetId: EntityId
  effect: StatusEffect
  authoredKey?: DamageOrderKey
  sourceAttribution?: DamageAttribution
}

export interface PendingMark {
  targetId: EntityId
  attribution: DamageAttribution
  mark: TargetMarkConfig
  propagateSquad: boolean
  authoredKey?: DamageOrderKey
}

export interface ResolvedDamageTakenIntent {
  targetExternalId: string
  sourceExternalId: string
  sourceEntityId?: EntityId
  sourceUnitType?: string
  sourceTeam?: Team
  damage: number
}

export interface PendingDefenseGrant {
  targetId: EntityId
  amount: number
  sourceExternalId: string
  kind: 'shield' | 'shield_capacity' | 'barrier_capacity'
}

export class EcsActionGroupLedger {
  readonly startHp = new Map<EntityId, number>()
  readonly damage = new Map<EntityId, PendingDamage[]>()
  readonly healing = new Map<EntityId, PendingHealing[]>()
  readonly forcedDeaths = new Map<EntityId, { source?: DamageAttribution; cause: DeathCause }>()
  readonly statuses: PendingStatus[] = []
  readonly marks: PendingMark[] = []
  readonly defenseGrants: PendingDefenseGrant[] = []
  readonly claims: DamageClaim[] = []
  readonly resolvedDamageTaken: ResolvedDamageTakenIntent[] = []
  readonly barrierExpirations = new Set<string>()
  readonly barrierBreaks = new Set<string>()
  frame: CombatDefenseFrame | undefined
  resolution: DefenseBatchResolution | undefined
  groupKey: ResolutionGroupKey | undefined
  active = false
  committing = false

  begin(world: CombatWorld, entityIds: readonly EntityId[], groupKey?: ResolutionGroupKey): void {
    this.startHp.clear()
    this.damage.clear()
    this.healing.clear()
    this.forcedDeaths.clear()
    this.statuses.length = 0
    this.marks.length = 0
    this.defenseGrants.length = 0
    this.claims.length = 0
    this.resolvedDamageTaken.length = 0
    this.barrierExpirations.clear()
    this.barrierBreaks.clear()
    this.resolution = undefined
    this.committing = false
    const captured = world.query(['identity', 'vitality', 'transform', 'combat', 'movement', 'statusControl', 'defense'], true)
    const targetIds = (captured.length > 0 ? captured : entityIds)
      .filter(entityId => !world.stores.vitality.require(entityId).isDead)
    const targetsByExternalId = new Map<string, import('./ecs/defense-batch').TargetDefenseSnapshot>()
    const entityByExternalId = new Map<string, EntityId>()
    const liveSourceExternalIds = new Set<string>()
    for (const entityId of targetIds) {
      const vitality = world.stores.vitality.require(entityId)
      const identity = world.stores.identity.require(entityId)
      const transform = world.stores.transform.require(entityId)
      const combat = world.stores.combat.require(entityId)
      const movement = world.stores.movement.require(entityId)
      const statusControl = world.stores.statusControl.require(entityId)
      const defense = world.stores.defense.require(entityId)
      entityByExternalId.set(identity.id, entityId)
      if (!vitality.isDead) {
        this.startHp.set(entityId, vitality.hp)
        liveSourceExternalIds.add(identity.id)
      }
      targetsByExternalId.set(identity.id, {
        externalId: identity.id, hp: vitality.hp, maxHp: vitality.maxHp, shield: vitality.shield, maxShield: vitality.maxShield,
        armor: combat.defense, statusEffects: structuredClone(statusControl.statusEffects), targetMark: statusControl.targetMark ? structuredClone(statusControl.targetMark) : undefined,
        isFlying: transform.isFlying, rank: identity.rank, isMoving: movement.isMoving, damageReductionWhileMoving: movement.damageReductionWhileMoving,
        isBurrowed: movement.isBurrowed, burrowDamageReduction: movement.burrowConfig?.damageReduction, flatDamageBlock: defense.flatDamageBlock,
        shieldHitBlockCharges: defense.shieldHitBlockCharges, reactiveArmorCharges: defense.reactiveArmorCharges, reactiveArmorBlock: defense.reactiveArmorBlock,
        damageShareRadius: defense.damageShareRadius, damageShareRatio: defense.damageShareRatio, damageShareMaxTargets: defense.damageShareMaxTargets,
        team: identity.team, targetClass: identity.type,
        isSummon: world.stores.weapon.require(entityId).attackType === 'spawn' ||
          world.stores.entityTargets.require(entityId).summonOwner !== undefined ||
          vitality.isTemporary ||
          getEcsCombatTags(world, entityId).includes('summoner'),
        transform: { x: transform.x, y: transform.y, isFlying: transform.isFlying, size: transform.size, velocity: transform.velocity, currentAngle: transform.currentAngle },
      })
    }
    for (const target of [...targetsByExternalId.values()]) {
      const entityId = entityByExternalId.get(target.externalId)
      const radius = target.damageShareRadius ?? 0
      if (entityId === undefined || radius <= 0) continue
      const transform = world.stores.transform.require(entityId)
      const recipients = [...targetsByExternalId.values()].filter(candidate => {
        if (candidate.externalId === target.externalId || candidate.team !== target.team) return false
        const candidateId = entityByExternalId.get(candidate.externalId)
        if (candidateId === undefined) return false
        const candidateTransform = world.stores.transform.require(candidateId)
        return getDistance(transform.x, transform.y, candidateTransform.x, candidateTransform.y) <= radius
      }).map(candidate => candidate.externalId).sort()
      targetsByExternalId.set(target.externalId, { ...target, sharingRecipients: recipients })
    }
    const barriersByExternalId = new Map<string, import('./ecs/defense-batch').BarrierDefenseSnapshot>()
    const barrierEntityByExternalId = new Map<string, EntityId>()
    for (const barrierId of world.query(['entityMeta', 'hazard'], true)) {
      const barrier = world.stores.hazard.require(barrierId)
      if (barrier.type !== 'barrier_dome' || barrier.duration <= 0) continue
      const coveredTargetExternalIds = [...targetsByExternalId.values()].filter(target => {
        if (target.team !== barrier.team) return false
        const targetId = entityByExternalId.get(target.externalId)
        if (targetId === undefined) return false
        const transform = world.stores.transform.require(targetId)
        return getDistance(transform.x, transform.y, barrier.x, barrier.y) <= barrier.radius
      }).map(target => target.externalId).sort()
      barriersByExternalId.set(barrier.id, { externalId: barrier.id, capacity: barrier.capacity ?? 0, maxCapacity: barrier.maxCapacity, damageReduction: barrier.damageReduction, coveredTargetExternalIds, sourceExternalId: barrier.sourceUnitId, team: barrier.team, active: barrier.duration > 0 })
      barrierEntityByExternalId.set(barrier.id, barrierId)
    }
    this.frame = { defense: { targetsByExternalId, barriersByExternalId }, routing: { entityByExternalId, barrierEntityByExternalId, liveSourceExternalIds } }
    this.groupKey = groupKey
    this.active = true
  }

  captureClaim(claim: DamageClaim): void {
    if (!this.active) throw new CombatInvariantError('Cannot submit a damage claim outside an active group')
    this.claims.push(claim)
  }

  assertRoutingIntact(world: CombatWorld): void {
    if (!this.frame) return
    for (const [externalId, entityId] of this.frame.routing.entityByExternalId) {
      if (!world.stores.vitality.get(entityId) || world.getEntityId(externalId) !== entityId) throw new CombatInvariantError(`Routed target removed before defense commit: ${externalId}`)
    }
    for (const [externalId, entityId] of this.frame.routing.barrierEntityByExternalId) {
      if (!world.stores.hazard.get(entityId) || world.getEntityId(externalId) !== entityId) throw new CombatInvariantError(`Routed barrier removed before defense commit: ${externalId}`)
    }
  }

  queueForcedDeath(targetId: EntityId, source: DamageAttribution | undefined, cause: DeathCause): void {
    this.forcedDeaths.set(targetId, { source, cause })
  }

  queueDamage(targetId: EntityId, attribution: DamageAttribution, amount: number, cause?: DeathCause): void {
    if (amount <= 0) return
    const entries = this.damage.get(targetId) ?? []
    entries.push({ attribution, amount, cause })
    this.damage.set(targetId, entries)
  }

  getProjectedHp(world: CombatWorld, targetId: EntityId): number {
    if (this.forcedDeaths.has(targetId)) return 0
    const startHp = this.startHp.get(targetId) ?? world.stores.vitality.require(targetId).hp
    const healing = (this.healing.get(targetId) ?? []).reduce((sum, entry) => sum + entry.amount, 0)
    const damage = (this.damage.get(targetId) ?? []).reduce((sum, entry) => sum + entry.amount, 0)
    return startHp + healing - damage
  }

  queueHealing(targetId: EntityId, sourceExternalId: string, amount: number, kind?: PendingHealing['kind']): void {
    if (amount <= 0) return
    const entries = this.healing.get(targetId) ?? []
    entries.push({ sourceExternalId, amount, kind })
    this.healing.set(targetId, entries)
  }

  queueStatus(targetId: EntityId, effect: StatusEffect, authoredKey?: DamageOrderKey, sourceAttribution?: DamageAttribution): void {
    if (authoredKey && this.statuses.some(entry => entry.authoredKey && compareDamageOrder(entry.authoredKey, authoredKey) === 0)) {
      throw new CombatInvariantError(`Duplicate status authored key: ${JSON.stringify(authoredKey)}`)
    }
    this.statuses.push({ targetId, effect: { ...effect }, authoredKey, sourceAttribution })
  }

  queueMark(targetId: EntityId, attribution: DamageAttribution, mark: TargetMarkConfig, propagateSquad = false, authoredKey?: DamageOrderKey): void {
    if (authoredKey && this.marks.some(entry => entry.authoredKey && compareDamageOrder(entry.authoredKey, authoredKey) === 0)) {
      throw new CombatInvariantError(`Duplicate mark authored key: ${JSON.stringify(authoredKey)}`)
    }
    this.marks.push({ targetId, attribution, mark: structuredClone(mark), propagateSquad, authoredKey })
  }

  queueDefenseGrant(targetId: EntityId, amount: number, sourceExternalId: string, kind: PendingDefenseGrant['kind']): void {
    if (amount <= 0) return
    this.defenseGrants.push({ targetId, amount, sourceExternalId, kind })
  }

  queueBarrierExpiration(externalId: string): void {
    if (this.active) this.barrierExpirations.add(externalId)
  }

  finish(): void {
    this.active = false
    this.committing = false
  }
}

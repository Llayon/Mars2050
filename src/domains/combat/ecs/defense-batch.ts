import type { RankScalingConfig, RuntimeStatusEffect, TargetMark, Team } from '../combat.primitives'
import {
  applyAccuracyPure,
  applyArmorReduction,
  applyFlatBlockPure,
  applyMovementReductionPure,
  applyOutputSuppressionPure,
  applySummonCounterPure,
  applyTargetStatusesPure,
  getMarkDamageMultiplierPure,
  getMarkExecuteThresholdPure,
  getRankMultiplierPure,
  getStatusValuePure,
} from './damage-kernel-pure'

/** The two deterministic damage execution modes supported by the combat ECS. */
export type DefenseResolutionMode = 'v8_sequential' | 'v9_snapshot'
export type DefenseInteractionPolicy = 'full' | 'bypass_all'

/** Stable, locale-independent ordering key for a damage claim. */
export interface DamageOrderKey {
  readonly originExternalId: string
  readonly authoredOrdinal: number
  readonly targetExternalId: string
  readonly sourceExternalId: string
}

export interface CapturedAttackerModifiers {
  attackBoostValue?: number
  outputSuppression?: number
  accuracyPenalty?: number
  accuracyPenaltyResist?: number
  armorPierceRatio?: number
  antiAirDamageMult?: number
  groundDamageMult?: number
  rank?: number
  rankScaling?: RankScalingConfig
  summonCounterDamageMult?: number
  shieldDamageMult?: number
  lifestealMult?: number
  executeThreshold?: number
  percentHpDamage?: { percent: number; basis?: 'max' | 'current'; maxBonus: number; minBonus?: number }
}

export interface DamageClaim {
  readonly order?: DamageOrderKey
  readonly targetExternalId: string
  readonly sourceExternalId: string
  readonly originExternalId: string
  readonly authoredOrdinal: number
  readonly rawDamage: number
  readonly sourceTeam?: Team
  readonly sourceUnitType?: string
  readonly attackerModifiers?: CapturedAttackerModifiers
  readonly capturedAttackerModifiers?: CapturedAttackerModifiers
  readonly defensePolicy?: DefenseInteractionPolicy
  readonly allowMinimumDamage?: boolean
  readonly allowPercentHpDamage?: boolean
  readonly deathCause?: string
  readonly deferredConsequences?: readonly unknown[]
  /** True when the source was present and alive at group start. */
  readonly sourceAliveAtGroupStart?: boolean
}

export interface TargetDefenseSnapshot {
  readonly externalId: string
  readonly hp: number
  readonly maxHp?: number
  readonly shield?: number
  readonly maxShield?: number
  readonly armor?: number
  readonly statusEffects?: readonly RuntimeStatusEffect[]
  readonly targetMark?: TargetMark
  readonly isFlying?: boolean
  readonly rank?: number
  readonly tags?: readonly string[]
  readonly isMoving?: boolean
  readonly damageReductionWhileMoving?: number
  readonly isBurrowed?: boolean
  readonly burrowDamageReduction?: number
  readonly flatDamageBlock?: { amount: number; perRank?: number; minimumDamage?: number }
  readonly shieldHitBlockCharges?: number
  readonly reactiveArmorCharges?: number
  readonly reactiveArmorBlock?: number
  readonly damageShareRadius?: number
  readonly damageShareRatio?: number
  readonly damageShareMaxTargets?: number
  readonly sharingRecipients?: readonly string[]
  readonly team?: Team
  readonly targetClass?: string
  readonly isSummon?: boolean
  readonly transform?: { x: number; y: number; isFlying: boolean; size?: 'S' | 'M' | 'L' | 'XL'; velocity?: { x: number; y: number }; currentAngle?: number }
}

export interface BarrierDefenseSnapshot {
  readonly externalId: string
  readonly capacity: number
  readonly maxCapacity?: number
  readonly damageReduction?: number
  readonly coveredTargetExternalIds: readonly string[]
  readonly sourceExternalId?: string
  readonly active?: boolean
  readonly team?: Team
}

export interface DefenseBatchSnapshot {
  readonly targetsByExternalId: ReadonlyMap<string, TargetDefenseSnapshot>
  readonly barriersByExternalId: ReadonlyMap<string, BarrierDefenseSnapshot>
}

export interface DefenseRoutingSnapshot {
  readonly entityByExternalId: ReadonlyMap<string, number>
  readonly barrierEntityByExternalId: ReadonlyMap<string, number>
  readonly liveSourceExternalIds: ReadonlySet<string>
}

export interface CombatDefenseFrame {
  readonly defense: DefenseBatchSnapshot
  readonly routing: DefenseRoutingSnapshot
}

export interface ResolvedDamageClaim {
  readonly claim: DamageClaim
  readonly targetExternalId: string
  readonly sourceExternalId: string
  readonly rawDamage: number
  readonly mitigatedDamage: number
  readonly hpDamage: number
  readonly bonusDamage: number
  readonly damage: number
  readonly shieldDamage: number
  readonly barrierDamage: number
  readonly barrierBlockedDamage: number
  readonly blockedDamage: number
  readonly sharedDamage: number
  readonly sharedDamageEvents: readonly { targetExternalId: string; damage: number }[]
  readonly shieldBroken: boolean
  readonly shieldHitBlock: boolean
  readonly reactiveArmorBlockedDamage: number
  readonly barrierBreaks: readonly string[]
  readonly lifesteal: number
}

export interface DefenseBatchResolution {
  readonly claims: readonly ResolvedDamageClaim[]
  readonly projectedHpByExternalId: ReadonlyMap<string, number>
  readonly healingIntents: readonly { targetExternalId: string; sourceExternalId: string; amount: number }[]
  readonly shieldByExternalId: ReadonlyMap<string, number>
  readonly shieldHitBlockChargesByExternalId: ReadonlyMap<string, number>
  readonly reactiveArmorChargesByExternalId: ReadonlyMap<string, number>
  readonly barrierCapacityByExternalId: ReadonlyMap<string, number>
}

export class CombatInvariantError extends Error {
  readonly code = 'COMBAT_INVARIANT'
  constructor(message: string) { super(message); this.name = 'CombatInvariantError' }
}

/** Code-unit comparator required by ADR-014. */
export function compareDamageOrder(left: DamageOrderKey, right: DamageOrderKey): number {
  return left.originExternalId < right.originExternalId ? -1 : left.originExternalId > right.originExternalId ? 1
    : left.authoredOrdinal - right.authoredOrdinal || (left.targetExternalId < right.targetExternalId ? -1 : left.targetExternalId > right.targetExternalId ? 1
      : left.sourceExternalId < right.sourceExternalId ? -1 : left.sourceExternalId > right.sourceExternalId ? 1 : 0)
}

export function sortDamageClaims(claims: readonly DamageClaim[]): DamageClaim[] {
  const sorted = [...claims].sort((a, b) => compareDamageOrder(toOrderKey(a), toOrderKey(b)))
  for (let index = 1; index < sorted.length; index += 1) {
    if (compareDamageOrder(toOrderKey(sorted[index - 1]!), toOrderKey(sorted[index]!)) === 0) {
      throw new CombatInvariantError(`Duplicate damage order key: ${JSON.stringify(toOrderKey(sorted[index]!))}`)
    }
  }
  return sorted
}

export function resolveDefenseBatch(snapshot: DefenseBatchSnapshot, inputClaims: readonly DamageClaim[]): DefenseBatchResolution {
  const claims = sortDamageClaims(inputClaims)
  const shields = new Map<string, number>()
  const shieldCharges = new Map<string, number>()
  const reactiveCharges = new Map<string, number>()
  const barriers = new Map<string, number>()
  const projected = new Map<string, number>()
  for (const target of snapshot.targetsByExternalId.values()) {
    shields.set(target.externalId, Math.max(0, target.shield ?? 0))
    shieldCharges.set(target.externalId, Math.max(0, target.shieldHitBlockCharges ?? 0))
    reactiveCharges.set(target.externalId, Math.max(0, target.reactiveArmorCharges ?? 0))
    projected.set(target.externalId, target.hp)
  }
  for (const barrier of snapshot.barriersByExternalId.values()) barriers.set(barrier.externalId, Math.max(0, barrier.capacity))
  const resolutions: ResolvedDamageClaim[] = []
  const healingIntents: { targetExternalId: string; sourceExternalId: string; amount: number }[] = []
  for (const claim of claims) {
    const target = snapshot.targetsByExternalId.get(claim.targetExternalId)
    if (!target) throw new CombatInvariantError(`Claim target is absent from defense frame: ${claim.targetExternalId}`)
    const policy = claim.defensePolicy ?? 'full'
    const raw = Math.max(0, Math.floor(claim.rawDamage))
    if (raw === 0) { resolutions.push(emptyResolution(claim)); continue }
    let damage = raw
    let blocked = 0
    let barrierBlocked = 0
    let barrierDamage = 0
    const barrierBreaks: string[] = []
    if (policy === 'full') {
      const modifiers = claim.attackerModifiers ?? claim.capturedAttackerModifiers ?? {}
      damage = applyArmorAndModifiers(target, claim, damage)
      const covered = [...snapshot.barriersByExternalId.values()]
        .filter(barrier => barrier.active !== false && barrier.coveredTargetExternalIds.includes(target.externalId))
        .sort((a, b) => a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0)
      for (const barrier of covered) {
        const available = barriers.get(barrier.externalId) ?? 0
        const absorbed = Math.min(available, damage)
        if (absorbed > 0) {
          barriers.set(barrier.externalId, available - absorbed)
          barrierDamage += absorbed
          barrierBlocked += absorbed
          damage -= absorbed
          if (available - absorbed === 0) barrierBreaks.push(barrier.externalId)
        }
      }
      const barrierReduction = covered.reduce((value, barrier) => Math.max(value, Math.max(0, Math.min(0.95, barrier.damageReduction ?? 0))), 0)
      if (barrierReduction > 0) damage = Math.floor(damage * (1 - barrierReduction))
      damage = applyTargetDefense(target, claim, damage)
      const beforeShield = damage
      const shield = shields.get(target.externalId) ?? 0
      const multiplier = Math.max(1, modifiers.shieldDamageMult ?? 1)
      const budget = Math.max(1, Math.floor(damage * multiplier))
      let shieldDamage = Math.min(shield, budget)
      let shieldBroken = false
      let shieldHitBlock = false
      let shieldHitBlockedDamage = 0
      if (shield > 0) {
        const remaining = shield - shieldDamage
        shields.set(target.externalId, remaining)
        shieldBroken = remaining === 0 && shieldDamage > 0
        damage = remaining > 0 ? 0 : Math.max(0, damage - Math.ceil(shield / multiplier))
        if (shieldBroken && damage > 0 && (shieldCharges.get(target.externalId) ?? 0) > 0) {
          shieldCharges.set(target.externalId, (shieldCharges.get(target.externalId) ?? 0) - 1)
          shieldHitBlock = true
          shieldHitBlockedDamage = damage
          damage = 0
        }
      }
      blocked += Math.max(0, raw - beforeShield) + shieldHitBlockedDamage
      let reactiveArmorBlockedDamage = 0
      if (damage > 0 && (reactiveCharges.get(target.externalId) ?? 0) > 0 && (target.reactiveArmorBlock ?? 0) > 0) {
        reactiveCharges.set(target.externalId, (reactiveCharges.get(target.externalId) ?? 0) - 1)
        reactiveArmorBlockedDamage = Math.min(damage, Math.floor(target.reactiveArmorBlock ?? 0))
        damage -= reactiveArmorBlockedDamage
        blocked += reactiveArmorBlockedDamage
      }
      const shared = resolveSharing(snapshot, target, claim, damage)
      damage = shared.remaining
      for (const event of shared.events) projected.set(event.targetExternalId, (projected.get(event.targetExternalId) ?? 0) - event.damage)
      const hpDamage = applyExecute(target, claim, damage, projected.get(target.externalId) ?? target.hp)
      projected.set(target.externalId, (projected.get(target.externalId) ?? target.hp) - hpDamage)
      const lifesteal = claim.sourceAliveAtGroupStart !== false ? Math.floor((hpDamage + shared.total) * Math.max(0, modifiers.lifestealMult ?? 0)) : 0
      if (lifesteal > 0) healingIntents.push({ targetExternalId: claim.sourceExternalId, sourceExternalId: claim.sourceExternalId, amount: lifesteal })
      const bonusDamage = Math.max(0, beforeShield - raw)
      resolutions.push({ claim, targetExternalId: target.externalId, sourceExternalId: claim.sourceExternalId, rawDamage: raw, mitigatedDamage: beforeShield, hpDamage, bonusDamage, damage: hpDamage, shieldDamage, barrierDamage, barrierBlockedDamage: barrierBlocked, blockedDamage: blocked, sharedDamage: shared.total, sharedDamageEvents: shared.events, shieldBroken, shieldHitBlock, reactiveArmorBlockedDamage, barrierBreaks, lifesteal })
    } else {
      projected.set(target.externalId, (projected.get(target.externalId) ?? target.hp) - damage)
      resolutions.push({ claim, targetExternalId: target.externalId, sourceExternalId: claim.sourceExternalId, rawDamage: raw, mitigatedDamage: damage, hpDamage: damage, bonusDamage: 0, damage, shieldDamage: 0, barrierDamage: 0, barrierBlockedDamage: 0, blockedDamage: 0, sharedDamage: 0, sharedDamageEvents: [], shieldBroken: false, shieldHitBlock: false, reactiveArmorBlockedDamage: 0, barrierBreaks: [], lifesteal: 0 })
    }
  }
  for (const intent of healingIntents) projected.set(intent.targetExternalId, (projected.get(intent.targetExternalId) ?? 0) + intent.amount)
  return { claims: resolutions, projectedHpByExternalId: projected, healingIntents, shieldByExternalId: shields, shieldHitBlockChargesByExternalId: shieldCharges, reactiveArmorChargesByExternalId: reactiveCharges, barrierCapacityByExternalId: barriers }
}

function applyArmorAndModifiers(target: TargetDefenseSnapshot, claim: DamageClaim, raw: number): number {
  const modifiers = claim.attackerModifiers ?? claim.capturedAttackerModifiers ?? {}
  const damageReduction = getStatusValuePure(target.statusEffects ?? [], 'armor_broken') ?? 0
  let damage = applyArmorReduction(raw, Math.max(0, target.armor ?? 0), damageReduction, modifiers.armorPierceRatio ?? 0, claim.allowMinimumDamage !== false)
  damage = applyOutputSuppressionPure(modifiers.outputSuppression ?? 0, damage)
  damage = applyAccuracyPure(modifiers.accuracyPenalty ?? 0, modifiers.accuracyPenaltyResist ?? 0, damage)
  if (target.isFlying && modifiers.antiAirDamageMult) damage = Math.floor(damage * modifiers.antiAirDamageMult)
  if (!target.isFlying && modifiers.groundDamageMult) damage = Math.floor(damage * modifiers.groundDamageMult)
  damage = Math.floor(damage * getRankMultiplierPure(modifiers.rank ?? 1, target.rank ?? 1, modifiers.rankScaling))
  return Math.max(0, applySummonCounterPure(target.isSummon === true, Math.max(1, modifiers.summonCounterDamageMult ?? 1), damage))
}

function applyTargetDefense(target: TargetDefenseSnapshot, claim: DamageClaim, damage: number): number {
  let result = applyTargetStatusesPure(target.statusEffects ?? [], damage)
  const revealed = (target.statusEffects ?? []).some(effect => effect.type === 'revealed' && effect.duration > 0)
  result = applyMovementReductionPure(target.isMoving === true, target.damageReductionWhileMoving ?? 0, target.isBurrowed === true, target.burrowDamageReduction ?? 0, revealed, result)
  const markMultiplier = getMarkDamageMultiplierPure(claim.sourceExternalId, target.targetMark)
  if (markMultiplier > 0) result = Math.max(0, Math.floor(result * (1 + markMultiplier)))
  return Math.max(0, applyFlatBlockPure(target.flatDamageBlock, target.rank ?? 1, result))
}

function resolveSharing(snapshot: DefenseBatchSnapshot, target: TargetDefenseSnapshot, claim: DamageClaim, damage: number): { remaining: number; total: number; events: { targetExternalId: string; damage: number }[] } {
  const recipients = target.sharingRecipients ?? []
  const ratio = Math.max(0, Math.min(1, target.damageShareRatio ?? 0))
  if (damage <= 0 || ratio <= 0 || recipients.length === 0) return { remaining: damage, total: 0, events: [] }
  const selected = recipients.filter(id => id !== target.externalId && snapshot.targetsByExternalId.has(id)).slice(0, Math.max(0, target.damageShareMaxTargets ?? recipients.length))
  if (selected.length === 0) return { remaining: damage, total: 0, events: [] }
  const share = Math.floor(damage * ratio)
  const remainder = damage - share
  const each = Math.floor(share / selected.length)
  let left = share - each * selected.length
  const events = selected.map(id => { const amount = each + (left-- > 0 ? 1 : 0); return { targetExternalId: id, damage: amount } }).filter(item => item.damage > 0)
  return { remaining: remainder, total: events.reduce((sum, item) => sum + item.damage, 0), events }
}

function applyExecute(target: TargetDefenseSnapshot, claim: DamageClaim, damage: number, hp: number): number {
  const markThreshold = getMarkExecuteThresholdPure(claim.sourceExternalId, target.targetMark)
  const threshold = Math.max(claim.attackerModifiers?.executeThreshold ?? claim.capturedAttackerModifiers?.executeThreshold ?? 0, markThreshold)
  return threshold > 0 && hp <= threshold ? hp : damage
}

function getStatus(effects: readonly RuntimeStatusEffect[] | undefined, type: RuntimeStatusEffect['type']): number {
  return (effects ?? []).filter(effect => effect.type === type && effect.duration > 0 && effect.value !== undefined).reduce((max, effect) => Math.max(max, effect.value ?? 0), 0)
}

function emptyResolution(claim: DamageClaim): ResolvedDamageClaim {
  return { claim, targetExternalId: claim.targetExternalId, sourceExternalId: claim.sourceExternalId, rawDamage: 0, mitigatedDamage: 0, hpDamage: 0, bonusDamage: 0, damage: 0, shieldDamage: 0, barrierDamage: 0, barrierBlockedDamage: 0, blockedDamage: 0, sharedDamage: 0, sharedDamageEvents: [], shieldBroken: false, shieldHitBlock: false, reactiveArmorBlockedDamage: 0, barrierBreaks: [], lifesteal: 0 }
}

function toOrderKey(claim: DamageClaim): DamageOrderKey {
  return claim.order ?? { originExternalId: claim.originExternalId, authoredOrdinal: claim.authoredOrdinal, targetExternalId: claim.targetExternalId, sourceExternalId: claim.sourceExternalId }
}

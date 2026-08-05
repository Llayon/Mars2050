import type { BattleAction } from '../../combat.actions'
import type { AbilityEffect, TargetSelector } from '../../combat.ability.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageSourceContext } from '../damage-source'
import type { PendingImpact } from '../pending-impacts'
import { getDistance, getSizeRadius } from '../../combat.utils'
import { applyEcsCapturedDamage } from './damage-system'
import { applyEcsStatus } from './status-application-system'
import { applyEcsCapturedTargetMark } from './target-mark-system'
import { captureLiveDamageSource } from '../damage-source'

export interface FrozenImpactTargets {
  readonly baseAreaTargets: readonly EntityId[]
  readonly groups: ReadonlyMap<string, readonly EntityId[]>
}

interface TargetContribution {
  rawDamage: number
  effects: AbilityEffect[]
}

export function freezeImpactTargets(
  world: CombatWorld,
  impact: PendingImpact,
  x: number,
  y: number,
): FrozenImpactTargets {
  const programs = impact.programs ?? []
  const selectors = programs.flatMap(program => program.groups.map(group => group.selector))
  const maxSelectorRadius = selectors.reduce((max, selector) => Math.max(max, getSelectorRadius(selector)), 0)
  const baseRadius = impact.payload.kind === 'area' ? impact.payload.radius : 0
  const primaryId = impact.payload.kind === 'direct' ? impact.payload.targetId ?? impact.targetId : undefined
  const primaryTransform = primaryId === undefined ? undefined : world.stores.transform.get(primaryId)
  const targetDistance = primaryTransform ? getDistance(x, y, primaryTransform.x, primaryTransform.y) : 0
  const queryRadius = Math.max(1, Math.max(baseRadius, maxSelectorRadius) + targetDistance + getSizeRadius('XL'))
  const candidates = world.resources.require('entitySpatial').query(world, x, y, queryRadius)
    .filter(entityId => isEligibleImpactTarget(world, impact, entityId))
  const groups = new Map<string, readonly EntityId[]>()
  for (const [programIndex, program] of programs.entries()) {
    for (const [groupIndex, group] of program.groups.entries()) {
      groups.set(`${programIndex}:${groupIndex}`, selectTargets(world, impact, candidates, primaryId, x, y, group.selector))
    }
  }
  const baseAreaTargets = impact.payload.kind === 'area'
    ? selectTargets(world, impact, candidates, primaryId, x, y, { kind: 'area_at_impact', radius: impact.payload.radius, maxTargets: impact.payload.maxTargets })
    : []
  return { baseAreaTargets, groups }
}

export function executeCapturedImpactPrograms(
  world: CombatWorld,
  impact: PendingImpact,
  frozen: FrozenImpactTargets,
  impactPoint: { x: number; y: number },
  actions: BattleAction[],
): void {
  const source = impact.sourceContext ?? (
    world.stores.identity.get(impact.sourceId)
      ? captureLiveDamageSource(world, impact.sourceId)
      : undefined
  )
  if (!source) throw new Error(`Missing captured source context for impact ${impact.id}`)
  const contributions = new Map<EntityId, TargetContribution>()
  const directProgramDamage = new Set<EntityId>()
  for (const [programIndex, program] of (impact.programs ?? []).entries()) {
    for (const [groupIndex, group] of program.groups.entries()) {
      for (const targetId of frozen.groups.get(`${programIndex}:${groupIndex}`) ?? []) {
        const contribution = contributions.get(targetId) ?? { rawDamage: 0, effects: [] }
        for (const effect of group.effects) {
          if (effect.kind === 'damage') {
            contribution.rawDamage += evaluateDamageExpression(effect, source)
            if (impact.payload.kind === 'direct') directProgramDamage.add(targetId)
          } else {
            contribution.effects.push(effect)
          }
        }
        contributions.set(targetId, contribution)
      }
    }
  }
  if (impact.payload.kind === 'area') {
    for (const targetId of frozen.baseAreaTargets) {
      const contribution = contributions.get(targetId) ?? { rawDamage: 0, effects: [] }
      contribution.rawDamage += impact.payload.damage
      contributions.set(targetId, contribution)
    }
  } else {
    const targetId = impact.payload.targetId ?? impact.targetId
    if (targetId !== undefined && !directProgramDamage.has(targetId)) {
      const contribution = contributions.get(targetId) ?? { rawDamage: 0, effects: [] }
      contribution.rawDamage += impact.payload.damage
      contributions.set(targetId, contribution)
    }
  }
  const ordered = [...contributions.entries()]
    .sort((left, right) => getDistance(impactPoint.x, impactPoint.y, world.stores.transform.require(left[0]).x, world.stores.transform.require(left[0]).y) -
      getDistance(impactPoint.x, impactPoint.y, world.stores.transform.require(right[0]).x, world.stores.transform.require(right[0]).y) ||
      world.stores.identity.require(left[0]).id.localeCompare(world.stores.identity.require(right[0]).id))
  for (const [targetId, contribution] of ordered) {
    const vitality = world.stores.vitality.get(targetId)
    if (!vitality || vitality.isDead) continue
    if (contribution.rawDamage > 0) {
      applyEcsCapturedDamage(world, source, targetId, contribution.rawDamage, actions, { interceptable: false })
    }
    if (getProjectedHp(world, targetId) <= 0) continue
    for (const effect of contribution.effects) {
      applyCapturedEffect(world, source, targetId, effect, actions)
    }
  }
}

export function evaluateDamageExpression(
  effect: Extract<AbilityEffect, { kind: 'damage' }>,
  source: DamageSourceContext,
): number {
  return effect.expression.kind === 'fixed'
    ? Math.max(0, Math.floor(effect.expression.amount))
    : Math.max(0, Math.floor(source.attack * effect.expression.multiplier))
}

export function evaluateLaunchRawDamage(source: DamageSourceContext, rawDamage: number): number {
  const boost = source.modifiers.attackBoostValue
  const boostMultiplier = boost >= 1 ? boost : 1 + boost
  return boost > 0
    ? Math.max(0, Math.floor(Math.floor(rawDamage) * Math.min(5, boostMultiplier)))
    : Math.max(0, Math.floor(rawDamage))
}

function applyCapturedEffect(
  world: CombatWorld,
  source: DamageSourceContext,
  targetId: EntityId,
  effect: AbilityEffect,
  actions: BattleAction[],
): void {
  if (effect.kind === 'apply_status') {
    applyEcsStatus(world, targetId, {
      type: effect.status,
      duration: effect.duration,
      value: effect.value,
      controlMode: effect.controlMode,
      sourceUnitId: source.attribution.sourceExternalId,
    }, actions)
    return
  }
  if (effect.kind === 'mark_target') {
    applyEcsCapturedTargetMark(world, source.attribution, targetId, {
      duration: effect.duration,
      damageMultiplier: effect.damageMultiplier,
      executeThreshold: effect.executeThreshold,
      sharedDamage: effect.sharedDamage,
      squadWide: effect.squadWide,
      focusPriority: effect.focusPriority,
      focusRadius: effect.focusRadius,
      retargetPolicy: effect.retargetPolicy,
      retargetLockTicks: effect.retargetLockTicks,
    }, actions)
  }
}

function selectTargets(
  world: CombatWorld,
  impact: PendingImpact,
  candidates: readonly EntityId[],
  primaryId: EntityId | undefined,
  x: number,
  y: number,
  selector: TargetSelector,
): readonly EntityId[] {
  if (selector.kind === 'primary_target') return primaryId !== undefined && candidates.includes(primaryId) ? [primaryId] : []
  if (selector.kind === 'self') return []
  const center = selector.kind === 'area_at_target' && primaryId !== undefined
    ? world.stores.transform.get(primaryId) ?? { x, y }
    : { x, y }
  return candidates
    .filter(targetId => getDistance(center.x, center.y, world.stores.transform.require(targetId).x, world.stores.transform.require(targetId).y) <= selector.radius + getSizeRadius(world.stores.transform.require(targetId).size))
    .sort((left, right) => getDistance(center.x, center.y, world.stores.transform.require(left).x, world.stores.transform.require(left).y) - getDistance(center.x, center.y, world.stores.transform.require(right).x, world.stores.transform.require(right).y) || world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id))
    .slice(0, selector.maxTargets ?? Number.MAX_SAFE_INTEGER)
}

function isEligibleImpactTarget(world: CombatWorld, impact: PendingImpact, entityId: EntityId): boolean {
  const identity = world.stores.identity.get(entityId)
  const vitality = world.stores.vitality.get(entityId)
  const transform = world.stores.transform.get(entityId)
  if (!identity || !vitality || !transform || vitality.isDead) return false
  if (identity.team !== (impact.hostileTeamAtLaunch ?? impact.targetTeam)) return false
  if (transform.isFlying && impact.canTargetAir === false) return false
  if (!transform.isFlying && impact.canTargetGround === false) return false
  return true
}

function getSelectorRadius(selector: TargetSelector): number {
  return selector.kind === 'area_at_target' || selector.kind === 'area_at_impact' ? selector.radius : 0
}

function getProjectedHp(world: CombatWorld, targetId: EntityId): number {
  const ledger = world.resources.get('actionGroup')
  return ledger?.getProjectedHp(world, targetId) ?? world.stores.vitality.require(targetId).hp
}

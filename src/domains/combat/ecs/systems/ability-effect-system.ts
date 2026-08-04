import type { BattleAction } from '../../combat.actions'
import type { AbilityEffect, AbilityExecutionOptions, AbilityTriggerKind, TargetSelector } from '../../combat.ability.types'
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'
import { applyEcsSingleDamage } from './damage-system'
import { applyEcsDirectionalGeometry } from './directional-geometry-system'
import { applyEcsBarrageAttack } from './barrage-attack-system'
import { applyEcsChainAttack } from './chain-attack-system'
import { applyEcsSplitFire } from './split-fire-system'
import { applyEcsSideWeapon } from './side-weapon-system'
import { applyEcsConditionalAttack } from './conditional-attack-system'
import { applyEcsSweepAttack } from './sweep-attack-system'
import { applyEcsRadialAoe } from './radial-aoe-system'
import { applyEcsDisplacement } from './displacement-system'
import { applyEcsTargetMark } from './target-mark-system'

export function runCompiledAbilityTrigger(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  trigger: Extract<AbilityTriggerKind, 'hit' | 'projectile_impact' | 'weapon_attack' | 'post_weapon_attack'>,
  actions: BattleAction[],
  impactPoint?: { x: number; y: number },
  options: AbilityExecutionOptions = {},
): boolean {
  let handledDamage = false
  const programs = world.stores.weapon.require(attackerId).abilityPrograms ?? []
  const executionMode = getAbilityExecutionMode(world, attackerId)
  for (const program of programs) {
    if (executionMode === 'legacy_mutable' && program.id.includes(':legacy:') || program.trigger.kind !== trigger) continue
    for (const group of program.groups) {
      for (const selected of selectTargets(world, attackerId, targetId, group.selector, impactPoint)) {
        for (const effect of group.effects) {
          handledDamage = applyEffect(world, attackerId, selected.targetId, effect, actions, {
            ...options,
            anchorPoint: selected.anchorPoint,
          }) || handledDamage
        }
      }
    }
  }
  return handledDamage
}

export function hasCompiledAbilityTrigger(
  world: CombatWorld,
  attackerId: EntityId,
  trigger: Extract<AbilityTriggerKind, 'weapon_attack' | 'post_weapon_attack'>,
): boolean {
  const executionMode = getAbilityExecutionMode(world, attackerId)
  return (world.stores.weapon.require(attackerId).abilityPrograms ?? [])
    .some(program => program.trigger.kind === trigger &&
      (executionMode === 'compiled' || !program.id.includes(':legacy:')))
}

export function hasCompiledHitAbility(world: CombatWorld, attackerId: EntityId): boolean {
  const executionMode = getAbilityExecutionMode(world, attackerId)
  return (world.stores.weapon.require(attackerId).abilityPrograms ?? [])
    .some(program => program.trigger.kind === 'hit' &&
      (executionMode === 'compiled' || !program.id.includes(':legacy:')))
}

export function getAbilityExecutionMode(world: CombatWorld, entityId: EntityId): 'compiled' | 'legacy_mutable' {
  const rules = world.stores.runtimeRules.require(entityId)
  if (rules.abilityProgramsAuthoritative === true) return 'compiled'
  return rules.abilityExecutionMode ?? 'legacy_mutable'
}

function selectTargets(world: CombatWorld, attackerId: EntityId, targetId: EntityId, selector: TargetSelector, impactPoint?: { x: number; y: number }): { targetId: EntityId; anchorPoint: { x: number; y: number } }[] {
  if (selector.kind === 'primary_target') return [{ targetId, anchorPoint: world.stores.transform.require(targetId) }]
  if (selector.kind === 'self') return [{ targetId: attackerId, anchorPoint: world.stores.transform.require(attackerId) }]
  if (selector.kind === 'impact_point') return []
  if (selector.kind !== 'area_at_target' && selector.kind !== 'area_at_impact') return []
  const center = selector.kind === 'area_at_impact' && impactPoint
    ? impactPoint
    : world.stores.transform.require(targetId)
  const attackerTeam = world.stores.identity.require(attackerId).team
  return world.resources.require('entitySpatial').query(world, center.x, center.y, selector.radius)
    .filter(candidateId => candidateId !== attackerId &&
      !world.stores.vitality.require(candidateId).isDead &&
      world.stores.identity.require(candidateId).team !== attackerTeam &&
      !world.stores.transform.require(candidateId).isFlying)
    .sort((left, right) => left - right)
    .slice(0, selector.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(selectedId => ({ targetId: selectedId, anchorPoint: { x: center.x, y: center.y } }))
}

function applyEffect(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  effect: AbilityEffect,
  actions: BattleAction[],
  options: AbilityExecutionOptions & { anchorPoint?: { x: number; y: number } },
): boolean {
  if (effect.kind === 'damage') {
    applyEcsSingleDamage(world, attackerId, targetId, effect.amount, actions, { interceptable: false })
    return true
  }
  if (effect.kind === 'legacy_geometry') {
    switch (effect.geometry) {
      case 'directional': applyEcsDirectionalGeometry(world, attackerId, targetId, actions); break
      case 'barrage': applyEcsBarrageAttack(world, attackerId, targetId, actions); break
      case 'chain': applyEcsChainAttack(world, attackerId, targetId, actions); break
      case 'split': applyEcsSplitFire(world, attackerId, targetId, actions); break
      case 'side': applyEcsSideWeapon(world, attackerId, targetId, actions); break
      case 'conditional': applyEcsConditionalAttack(world, attackerId, targetId, actions); break
      case 'sweep': applyEcsSweepAttack(world, attackerId, targetId, actions); break
      case 'radial': applyEcsRadialAoe(world, attackerId, targetId, actions); break
      case 'displacement': applyEcsDisplacement(world, attackerId, targetId, actions); break
    }
    return false
  }
  if (effect.kind === 'split_fire') {
    applyEcsSplitFire(world, attackerId, targetId, actions, effect.config)
    return false
  }
  if (effect.kind === 'chain_attack') {
    applyEcsChainAttack(world, attackerId, targetId, actions, effect.config)
    return false
  }
  if (effect.kind === 'side_weapon') {
    applyEcsSideWeapon(world, attackerId, targetId, actions, effect.config)
    return false
  }
  if (effect.kind === 'barrage_attack') {
    applyEcsBarrageAttack(world, attackerId, targetId, actions, effect.config)
    return false
  }
  if (effect.kind === 'line_pierce') {
    applyEcsDirectionalGeometry(world, attackerId, targetId, actions, { kind: 'line_pierce', config: effect.config })
    return false
  }
  if (effect.kind === 'cone_attack') {
    applyEcsDirectionalGeometry(world, attackerId, targetId, actions, { kind: 'cone_attack', config: effect.config })
    return false
  }
  if (effect.kind === 'beam_attack') {
    applyEcsDirectionalGeometry(world, attackerId, targetId, actions, { kind: 'beam_attack', config: effect.config })
    return false
  }
  if (effect.kind === 'apply_status') {
    applyEcsStatus(world, targetId, { type: effect.status, duration: effect.duration, value: effect.value, controlMode: effect.controlMode, sourceUnitId: world.stores.identity.require(attackerId).id }, actions)
    return false
  }
  if (effect.kind === 'mark_target') {
    applyEcsTargetMark(world, attackerId, targetId, {
      duration: effect.duration,
      damageMultiplier: effect.damageMultiplier,
      executeThreshold: effect.executeThreshold,
      sharedDamage: effect.sharedDamage,
      squadWide: effect.squadWide,
      focusPriority: effect.focusPriority,
      focusRadius: effect.focusRadius,
      retargetPolicy: effect.retargetPolicy,
      retargetLockTicks: effect.retargetLockTicks,
    }, actions, options.hitKind !== 'secondary')
    return false
  }
  if (effect.kind === 'displace') {
    applyDisplacement(world, attackerId, targetId, effect.mode, effect.strength, actions, options.anchorPoint)
  }
  return false
}

function applyDisplacement(world: CombatWorld, attackerId: EntityId, targetId: EntityId, mode: 'pull' | 'knockback', strength: number, actions: BattleAction[], anchorPoint?: { x: number; y: number }): void {
  const target = world.stores.transform.require(targetId)
  const source = world.stores.transform.require(attackerId)
  const anchor = anchorPoint ?? source
  const dx = mode === 'pull' ? anchor.x - target.x : target.x - source.x
  const dy = mode === 'pull' ? anchor.y - target.y : target.y - source.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const fromX = target.x
  const fromY = target.y
  world.setEntityPosition(targetId, Math.max(0, Math.min(FIELD_WIDTH, target.x + dx / distance * strength)), Math.max(0, Math.min(FIELD_HEIGHT, target.y + dy / distance * strength)))
  target.velocity = { x: 0, y: 0 }
  actions.push({ unitId: world.stores.identity.require(targetId).id, type: mode === 'pull' ? 'move' : 'knockback', fromX, fromY, toX: target.x, toY: target.y, facingAngle: target.currentAngle })
}

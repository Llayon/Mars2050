import type { CompiledAbilityProgram } from './combat.ability-compiler'
import type { AbilityEffect } from './combat.ability.types'
import type { UnitBaseStats } from './combat.types'
import type { CompiledBarrageShellPlan, CompiledTemporalWeaponPlan } from './combat.temporal.types'

export function compileTemporalWeaponPlan(
  unitType: string,
  stats: UnitBaseStats,
  programs: readonly CompiledAbilityProgram[],
): CompiledTemporalWeaponPlan | undefined {
  const delivery = stats.delivery
  const impactPrograms = programs
    .filter(program => program.trigger.kind === 'projectile_impact')
    .map(program => structuredClone(program))
  if (!delivery || delivery.kind === 'instant') {
    if (impactPrograms.length > 0) {
      throw new Error(`Invalid temporal loadout for ${unitType}: instant delivery cannot declare projectile_impact programs`)
    }
    return undefined
  }

  const primaryDamageGroups = impactPrograms.flatMap(program => program.groups)
    .filter(group => group.selector.kind === 'primary_target' &&
      group.effects.some(effect => effect.kind === 'damage'))
  if (primaryDamageGroups.length > 1) {
    throw new Error(`Invalid temporal loadout for ${unitType}: multiple primary_target damage groups`)
  }
  if (delivery.kind === 'ground_targeted' && impactPrograms.some(program =>
    program.groups.some(group => group.selector.kind !== 'area_at_impact'))) {
    throw new Error(`Invalid temporal loadout for ${unitType}: ground-targeted impact programs require area_at_impact`)
  }

  const typedBarrage = programs.flatMap(program => program.groups)
    .flatMap(group => group.effects)
    .filter((effect): effect is Extract<AbilityEffect, { kind: 'barrage_attack' }> =>
      effect.kind === 'barrage_attack')
  const legacyBarrage = stats.barrageAttack ? [stats.barrageAttack] : []
  if (delivery.kind !== 'ground_targeted') {
    return {
      delivery: structuredClone(delivery),
      impactPrograms,
    }
  }
  if (typedBarrage.length + legacyBarrage.length !== 1) {
    throw new Error(`Invalid temporal loadout for ${unitType}: ground-targeted delivery requires exactly one barrage plan`)
  }
  const config = typedBarrage[0]?.config ?? legacyBarrage[0]
  if (!config) throw new Error(`Invalid temporal loadout for ${unitType}: missing barrage plan`)
  return {
    delivery: structuredClone(delivery),
    impactPrograms,
    barrage: compileBarrageShellPlan(config),
  }
}

function compileBarrageShellPlan(config: NonNullable<UnitBaseStats['barrageAttack']>): CompiledBarrageShellPlan {
  const offsets = Array.from({ length: config.impacts }, (_, index) => {
    if (index === 0 || config.spreadRadius <= 0) return { x: 0, y: 0 }
    const angle = (index - 1) * 2.399963229728653
    const ring = 0.55 + (index % 3) * 0.225
    return {
      x: Math.cos(angle) * config.spreadRadius * ring,
      y: Math.sin(angle) * config.spreadRadius * ring,
    }
  })
  return {
    impacts: config.impacts,
    radius: config.radius,
    damageMultiplier: config.damageMultiplier,
    maxTargets: config.maxTargetsPerImpact ?? 6,
    impactIntervalTicks: config.impactIntervalTicks ?? 1,
    offsets,
  }
}

import type { RuntimeAttackCharge, RuntimeFieldEffect, RuntimePeriodicAbility, RuntimeStatGrowth, RuntimeTriggerEffect, SimUnit } from './combat.sim.types'
import type { UnitBaseStats } from './combat.types'

export function prepareRuntimePrimitives(unit: SimUnit, stats: UnitBaseStats): void {
  unit.periodicAbilities = createPeriodicAbilityState(stats)
  unit.triggerEffects = createTriggerEffectState(stats)
  unit.controlBeam = stats.controlBeam ? { ...stats.controlBeam } : undefined
  unit.transformMode = stats.transformMode?.map(mode => ({ ...mode }))
  unit.transformState = unit.transformMode ? { appliedIds: [] } : undefined
  unit.fieldEffect = createFieldEffectState(stats)
  unit.formationModifiers = stats.formationModifiers ? { ...stats.formationModifiers } : undefined
  unit.rankScaling = stats.rankScaling ? { ...stats.rankScaling, damageModifiers: stats.rankScaling.damageModifiers?.map(modifier => ({ ...modifier })) } : undefined
  unit.conditionalRange = stats.conditionalRange?.map(range => ({ ...range }))
  unit.flatDamageBlock = stats.flatDamageBlock ? { ...stats.flatDamageBlock } : undefined
  unit.shieldHitBlock = stats.shieldHitBlock ? { ...stats.shieldHitBlock } : undefined
  unit.shieldHitBlockCharges = stats.shieldHitBlock?.charges
  unit.statGrowth = createStatGrowthState(stats)
  unit.attackCharge = createAttackChargeState(stats)
  unit.reassemblyConfig = stats.reassembly ? { ...stats.reassembly } : undefined
  unit.targetPriorityProfile = stats.targetPriorityProfile
  unit.conditionalAttackMode = stats.conditionalAttackMode ? { ...stats.conditionalAttackMode } : undefined
  unit.sweepAttack = stats.sweepAttack ? { ...stats.sweepAttack } : undefined
  unit.linePierce = stats.linePierce ? { ...stats.linePierce } : undefined
  unit.coneAttack = stats.coneAttack ? { ...stats.coneAttack } : undefined
  unit.beamAttack = stats.beamAttack ? { ...stats.beamAttack } : undefined
  unit.barrageAttack = stats.barrageAttack ? { ...stats.barrageAttack } : undefined
  unit.chainAttack = stats.chainAttack ? { ...stats.chainAttack } : undefined
  unit.splitFire = stats.splitFire ? { ...stats.splitFire } : undefined
  unit.sideWeapon = stats.sideWeapon ? { ...stats.sideWeapon } : undefined
  unit.stealthWhileMoving = stats.stealthWhileMoving === true ? true : unit.stealthWhileMoving
}

export function getFormationSpacing(baseSpacing: number, stats: UnitBaseStats): number {
  const multiplier = stats.formationModifiers?.spacingMultiplier
  return multiplier !== undefined && multiplier > 0 ? baseSpacing * multiplier : baseSpacing
}

function createPeriodicAbilityState(stats: UnitBaseStats): RuntimePeriodicAbility[] | undefined {
  const abilities = stats.periodicAbilities?.map(ability => ({
    ...ability,
    nextTick: ability.initialDelayTicks ?? ability.intervalTicks,
    chargesRemaining: ability.charges,
  }))
  return abilities && abilities.length > 0 ? abilities : undefined
}

function createTriggerEffectState(stats: UnitBaseStats): RuntimeTriggerEffect[] | undefined {
  const triggers = stats.triggerEffects?.map(trigger => ({
    ...trigger,
    fired: false,
    counter: 0,
    triggersRemaining: trigger.maxTriggers,
    cooldownRemaining: 0,
  }))
  return triggers && triggers.length > 0 ? triggers : undefined
}

function createFieldEffectState(stats: UnitBaseStats): RuntimeFieldEffect[] | undefined {
  const effects = stats.fieldEffect?.map(effect => ({
    ...effect,
    nextTick: effect.initialDelayTicks ?? 0,
  }))
  return effects && effects.length > 0 ? effects : undefined
}

function createStatGrowthState(stats: UnitBaseStats): RuntimeStatGrowth | undefined {
  if (!stats.statGrowth) return undefined
  return { ...stats.statGrowth, nextTick: stats.statGrowth.intervalTicks, stacks: 0 }
}

function createAttackChargeState(stats: UnitBaseStats): RuntimeAttackCharge | undefined {
  if (!stats.attackCharge) return undefined
  return { ...stats.attackCharge, nextTick: stats.attackCharge.intervalTicks, stacks: 0 }
}

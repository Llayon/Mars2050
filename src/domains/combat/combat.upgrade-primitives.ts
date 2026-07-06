import type { UnitBaseStats } from './combat.types'
import { UPGRADES } from './combat.upgrades'

export function getRuntimePrimitiveStats(baseStats: UnitBaseStats, upgradePath: unknown): UnitBaseStats {
  const periodicAbilities = baseStats.periodicAbilities?.map(ability => ({ ...ability })) ?? []
  const triggerEffects = baseStats.triggerEffects?.map(trigger => ({ ...trigger })) ?? []
  const transformMode = baseStats.transformMode?.map(mode => ({ ...mode })) ?? []
  const fieldEffect = baseStats.fieldEffect?.map(effect => ({ ...effect })) ?? []
  let controlBeam = baseStats.controlBeam ? { ...baseStats.controlBeam } : undefined
  let formationModifiers = baseStats.formationModifiers ? { ...baseStats.formationModifiers } : undefined
  let statGrowth = baseStats.statGrowth ? { ...baseStats.statGrowth } : undefined
  let attackCharge = baseStats.attackCharge ? { ...baseStats.attackCharge } : undefined
  let reassembly = baseStats.reassembly ? { ...baseStats.reassembly } : undefined
  let targetPriorityProfile = baseStats.targetPriorityProfile
  let conditionalAttackMode = baseStats.conditionalAttackMode ? { ...baseStats.conditionalAttackMode } : undefined
  let sweepAttack = baseStats.sweepAttack ? { ...baseStats.sweepAttack } : undefined

  if (Array.isArray(upgradePath)) {
    for (const upgradeId of upgradePath) {
      if (typeof upgradeId !== 'string') continue
      const modifiers = UPGRADES[upgradeId]?.modifiers
      if (!modifiers) continue

      if (modifiers.periodicAbilities) periodicAbilities.push(...modifiers.periodicAbilities.map(ability => ({ ...ability })))
      if (modifiers.triggerEffects) triggerEffects.push(...modifiers.triggerEffects.map(trigger => ({ ...trigger })))
      if (modifiers.transformMode) transformMode.push(...modifiers.transformMode.map(mode => ({ ...mode })))
      if (modifiers.fieldEffect) fieldEffect.push(...modifiers.fieldEffect.map(effect => ({ ...effect })))
      if (modifiers.controlBeam) controlBeam = { ...modifiers.controlBeam }
      if (modifiers.formationModifiers) formationModifiers = { ...modifiers.formationModifiers }
      if (modifiers.statGrowth) statGrowth = { ...modifiers.statGrowth }
      if (modifiers.attackCharge) attackCharge = { ...modifiers.attackCharge }
      if (modifiers.reassembly) reassembly = { ...modifiers.reassembly }
      if (modifiers.targetPriorityProfile) targetPriorityProfile = modifiers.targetPriorityProfile
      if (modifiers.conditionalAttackMode) conditionalAttackMode = { ...modifiers.conditionalAttackMode }
      if (modifiers.sweepAttack) sweepAttack = { ...modifiers.sweepAttack }
    }
  }

  return {
    ...baseStats,
    periodicAbilities: periodicAbilities.length > 0 ? periodicAbilities : undefined,
    triggerEffects: triggerEffects.length > 0 ? triggerEffects : undefined,
    transformMode: transformMode.length > 0 ? transformMode : undefined,
    controlBeam,
    fieldEffect: fieldEffect.length > 0 ? fieldEffect : undefined,
    formationModifiers,
    statGrowth,
    attackCharge,
    reassembly,
    targetPriorityProfile,
    conditionalAttackMode,
    sweepAttack,
  }
}

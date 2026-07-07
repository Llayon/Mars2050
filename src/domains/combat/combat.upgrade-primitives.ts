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
  let rankScaling = baseStats.rankScaling ? { ...baseStats.rankScaling, damageModifiers: baseStats.rankScaling.damageModifiers?.map(modifier => ({ ...modifier })) } : undefined
  let conditionalRange = baseStats.conditionalRange?.map(range => ({ ...range })) ?? []
  let flatDamageBlock = baseStats.flatDamageBlock ? { ...baseStats.flatDamageBlock } : undefined
  let shieldHitBlock = baseStats.shieldHitBlock ? { ...baseStats.shieldHitBlock } : undefined
  let targetPriorityProfile = baseStats.targetPriorityProfile
  let conditionalAttackMode = baseStats.conditionalAttackMode ? { ...baseStats.conditionalAttackMode } : undefined
  let sweepAttack = baseStats.sweepAttack ? { ...baseStats.sweepAttack } : undefined
  let linePierce = baseStats.linePierce ? { ...baseStats.linePierce } : undefined
  let coneAttack = baseStats.coneAttack ? { ...baseStats.coneAttack } : undefined
  let beamAttack = baseStats.beamAttack ? { ...baseStats.beamAttack } : undefined
  let barrageAttack = baseStats.barrageAttack ? { ...baseStats.barrageAttack } : undefined
  let chainAttack = baseStats.chainAttack ? { ...baseStats.chainAttack } : undefined
  let splitFire = baseStats.splitFire ? { ...baseStats.splitFire } : undefined
  let sideWeapon = baseStats.sideWeapon ? { ...baseStats.sideWeapon } : undefined
  let stealthWhileMoving = baseStats.stealthWhileMoving === true

  if (Array.isArray(upgradePath)) {
    for (const upgradeId of upgradePath) {
      if (typeof upgradeId !== 'string') continue
      const modifiers = UPGRADES[upgradeId]?.modifiers
      if (!modifiers) continue

      if (modifiers.periodicAbilities) periodicAbilities.push(...modifiers.periodicAbilities.map(ability => ({ ...ability })))
      if (modifiers.triggerEffects) triggerEffects.push(...modifiers.triggerEffects.map(trigger => ({ ...trigger })))
      if (modifiers.onDeathSpawn) triggerEffects.push(createOnDeathSpawnTrigger(upgradeId, modifiers.onDeathSpawn))
      if (modifiers.transformMode) transformMode.push(...modifiers.transformMode.map(mode => ({ ...mode })))
      if (modifiers.fieldEffect) fieldEffect.push(...modifiers.fieldEffect.map(effect => ({ ...effect })))
      if (modifiers.controlBeam) controlBeam = { ...modifiers.controlBeam }
      if (modifiers.formationModifiers) formationModifiers = { ...modifiers.formationModifiers }
      if (modifiers.statGrowth) statGrowth = { ...modifiers.statGrowth }
      if (modifiers.attackCharge) attackCharge = { ...modifiers.attackCharge }
      if (modifiers.reassembly) reassembly = { ...modifiers.reassembly }
      if (modifiers.rankScaling) rankScaling = { ...modifiers.rankScaling, damageModifiers: modifiers.rankScaling.damageModifiers?.map(modifier => ({ ...modifier })) }
      if (modifiers.conditionalRange) conditionalRange.push(...modifiers.conditionalRange.map(range => ({ ...range })))
      if (modifiers.flatDamageBlock) flatDamageBlock = { ...modifiers.flatDamageBlock }
      if (modifiers.shieldHitBlock) shieldHitBlock = { ...modifiers.shieldHitBlock }
      if (modifiers.targetPriorityProfile) targetPriorityProfile = modifiers.targetPriorityProfile
      if (modifiers.conditionalAttackMode) conditionalAttackMode = { ...modifiers.conditionalAttackMode }
      if (modifiers.sweepAttack) sweepAttack = { ...modifiers.sweepAttack }
      if (modifiers.linePierce) linePierce = { ...modifiers.linePierce }
      if (modifiers.coneAttack) coneAttack = { ...modifiers.coneAttack }
      if (modifiers.beamAttack) beamAttack = { ...modifiers.beamAttack }
      if (modifiers.barrageAttack) barrageAttack = { ...modifiers.barrageAttack }
      if (modifiers.chainAttack) chainAttack = { ...modifiers.chainAttack }
      if (modifiers.splitFire) splitFire = { ...modifiers.splitFire }
      if (modifiers.sideWeapon) sideWeapon = { ...modifiers.sideWeapon }
      if (modifiers.stealthWhileMoving) stealthWhileMoving = true
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
    rankScaling,
    conditionalRange: conditionalRange.length > 0 ? conditionalRange : undefined,
    flatDamageBlock,
    shieldHitBlock,
    targetPriorityProfile,
    conditionalAttackMode,
    sweepAttack,
    linePierce,
    coneAttack,
    beamAttack,
    barrageAttack,
    chainAttack,
    splitFire,
    sideWeapon,
    stealthWhileMoving: stealthWhileMoving ? true : undefined,
  }
}

function createOnDeathSpawnTrigger(upgradeId: string, unitType: string): NonNullable<UnitBaseStats['triggerEffects']>[number] {
  return {
    id: `${upgradeId}-on-death-spawn`,
    event: 'death',
    payload: { kind: 'spawn', target: 'self', unitType, count: 1, cap: 1 },
  }
}

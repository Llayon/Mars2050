import type { UnitBaseStats } from './combat.types.js'
import type { PreparedStats } from './contracts/prepared.contracts.js'
import type { UpgradeConfig } from './combat.catalog.types.js'

export function getRuntimePrimitiveStats(
  baseStats: UnitBaseStats,
  upgradePath: unknown,
  upgradesCatalog?: Record<string, UpgradeConfig>,
  preparedStats?: PreparedStats,
): UnitBaseStats {
  const catalog = upgradesCatalog ?? {}
  const periodicAbilities = baseStats.periodicAbilities?.map(ability => ({ ...ability })) ?? []
  const triggerEffects = baseStats.triggerEffects?.map(trigger => ({ ...trigger })) ?? []
  const skipPeriodic = preparedStats?.periodicAbilities !== undefined
  const skipTriggers = preparedStats?.triggerEffects !== undefined
  const skipFieldEffect = preparedStats?.fieldEffect !== undefined
  const skipControlBeam = preparedStats?.controlBeam !== undefined
  const skipTransform = preparedStats?.transformMode !== undefined
  const skipFormation = preparedStats?.formationModifiers !== undefined
  const skipStatGrowth = preparedStats?.statGrowth !== undefined
  const skipAttackCharge = preparedStats?.attackCharge !== undefined
  const skipReassembly = preparedStats?.reassembly !== undefined
  const skipRankScaling = preparedStats?.rankScaling !== undefined
  const skipConditionalRange = preparedStats?.conditionalRange !== undefined
  const skipFlatDamageBlock = preparedStats?.flatDamageBlock !== undefined
  const skipShieldHitBlock = preparedStats?.shieldHitBlock !== undefined
  const skipTargetPriority = preparedStats?.targetPriorityProfile !== undefined
  const skipConditionalAttack = preparedStats?.conditionalAttackMode !== undefined
  const skipSweep = preparedStats?.sweepAttack !== undefined
  const skipLinePierce = preparedStats?.linePierce !== undefined
  const skipCone = preparedStats?.coneAttack !== undefined
  const skipBeam = preparedStats?.beamAttack !== undefined
  const skipBarrage = preparedStats?.barrageAttack !== undefined
  const skipChain = preparedStats?.chainAttack !== undefined
  const skipSplitFire = preparedStats?.splitFire !== undefined
  const skipSideWeapon = preparedStats?.sideWeapon !== undefined
  const skipStealth = preparedStats?.stealthWhileMoving !== undefined
  const transformMode = baseStats.transformMode?.map(mode => ({ ...mode })) ?? []
  const fieldEffect = baseStats.fieldEffect?.map(effect => ({ ...effect })) ?? []
  let controlBeam = baseStats.controlBeam ? { ...baseStats.controlBeam } : undefined
  let formationModifiers = baseStats.formationModifiers ? { ...baseStats.formationModifiers } : undefined
  let statGrowth = baseStats.statGrowth ? { ...baseStats.statGrowth } : undefined
  let attackCharge = baseStats.attackCharge ? { ...baseStats.attackCharge } : undefined
  let reassembly = baseStats.reassembly ? { ...baseStats.reassembly } : undefined
  let rankScaling = baseStats.rankScaling ? { ...baseStats.rankScaling, damageModifiers: baseStats.rankScaling.damageModifiers?.map(modifier => ({ ...modifier })) } : undefined
  const conditionalRange = baseStats.conditionalRange?.map(range => ({ ...range })) ?? []
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
      const modifiers = catalog[upgradeId]?.modifiers
      if (!modifiers) continue

      if (!skipPeriodic && modifiers.periodicAbilities) {
        periodicAbilities.push(...modifiers.periodicAbilities.map(ability => ({ ...ability })))
      }
      if (!skipTriggers) {
        if (modifiers.triggerEffects) triggerEffects.push(...modifiers.triggerEffects.map(trigger => ({ ...trigger })))
        if (modifiers.onDeathSpawn) triggerEffects.push(createOnDeathSpawnTrigger(upgradeId, modifiers.onDeathSpawn))
      }
      if (!skipTransform && modifiers.transformMode) transformMode.push(...modifiers.transformMode.map(mode => ({ ...mode })))
      if (!skipFieldEffect && modifiers.fieldEffect) fieldEffect.push(...modifiers.fieldEffect.map(effect => ({ ...effect })))
      if (!skipControlBeam && modifiers.controlBeam) controlBeam = { ...modifiers.controlBeam }
      if (!skipFormation && modifiers.formationModifiers) formationModifiers = { ...modifiers.formationModifiers }
      if (!skipStatGrowth && modifiers.statGrowth) statGrowth = { ...modifiers.statGrowth }
      if (!skipAttackCharge && modifiers.attackCharge) attackCharge = { ...modifiers.attackCharge }
      if (!skipReassembly && modifiers.reassembly) reassembly = { ...modifiers.reassembly }
      if (!skipRankScaling && modifiers.rankScaling) rankScaling = { ...modifiers.rankScaling, damageModifiers: modifiers.rankScaling.damageModifiers?.map(modifier => ({ ...modifier })) }
      if (!skipConditionalRange && modifiers.conditionalRange) conditionalRange.push(...modifiers.conditionalRange.map(range => ({ ...range })))
      if (!skipFlatDamageBlock && modifiers.flatDamageBlock) flatDamageBlock = { ...modifiers.flatDamageBlock }
      if (!skipShieldHitBlock && modifiers.shieldHitBlock) shieldHitBlock = { ...modifiers.shieldHitBlock }
      if (!skipTargetPriority && modifiers.targetPriorityProfile) targetPriorityProfile = modifiers.targetPriorityProfile
      if (!skipConditionalAttack && modifiers.conditionalAttackMode) conditionalAttackMode = { ...modifiers.conditionalAttackMode }
      if (!skipSweep && modifiers.sweepAttack) sweepAttack = { ...modifiers.sweepAttack }
      if (!skipLinePierce && modifiers.linePierce) linePierce = { ...modifiers.linePierce }
      if (!skipCone && modifiers.coneAttack) coneAttack = { ...modifiers.coneAttack }
      if (!skipBeam && modifiers.beamAttack) beamAttack = { ...modifiers.beamAttack }
      if (!skipBarrage && modifiers.barrageAttack) barrageAttack = { ...modifiers.barrageAttack }
      if (!skipChain && modifiers.chainAttack) chainAttack = { ...modifiers.chainAttack }
      if (!skipSplitFire && modifiers.splitFire) splitFire = { ...modifiers.splitFire }
      if (!skipSideWeapon && modifiers.sideWeapon) sideWeapon = { ...modifiers.sideWeapon }
      if (!skipStealth && modifiers.stealthWhileMoving) stealthWhileMoving = true
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

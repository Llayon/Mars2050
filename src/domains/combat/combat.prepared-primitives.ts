import type { PreparedStats, RankScalingConfigContract as RankScalingConfig } from '@mars2050/combat-core/contracts'
import type { UpgradeConfig } from './combat.upgrades'

/**
 * Collects and accumulates all 24 primitive modifier families for Mars adapter loadouts
 * from base stats and active upgrade configurations.
 */
export function collectMarsPreparedPrimitives(
  base: Record<string, unknown>,
  upgradeIds: string[],
  upgradeRecord: Readonly<Record<string, { modifiers?: Partial<UpgradeConfig['modifiers']> | Record<string, unknown> }>>,
): Partial<PreparedStats> {
  const periodicAbilities: Record<string, unknown>[] = [
    ...((base.periodicAbilities as unknown as Record<string, unknown>[] | undefined) ?? []),
  ]
  const triggerEffects: Record<string, unknown>[] = [
    ...((base.triggerEffects as unknown as Record<string, unknown>[] | undefined) ?? []),
  ]
  const transformMode: Record<string, unknown>[] = [
    ...((base.transformMode as unknown as Record<string, unknown>[] | undefined) ?? []),
  ]
  const fieldEffect: Record<string, unknown>[] = [
    ...((base.fieldEffect as unknown as Record<string, unknown>[] | undefined) ?? []),
  ]
  let controlBeam: Record<string, unknown> | undefined = base.controlBeam
    ? { ...(base.controlBeam as Record<string, unknown>) }
    : undefined
  let formationModifiers: Record<string, unknown> | undefined = base.formationModifiers
    ? { ...(base.formationModifiers as Record<string, unknown>) }
    : undefined
  let statGrowth: Record<string, unknown> | undefined = base.statGrowth
    ? { ...(base.statGrowth as Record<string, unknown>) }
    : undefined
  let attackCharge: Record<string, unknown> | undefined = base.attackCharge
    ? { ...(base.attackCharge as Record<string, unknown>) }
    : undefined
  let reassembly: Record<string, unknown> | undefined = base.reassembly
    ? { ...(base.reassembly as Record<string, unknown>) }
    : undefined
  let rankScaling: RankScalingConfig | undefined = base.rankScaling
    ? { ...(base.rankScaling as RankScalingConfig) }
    : undefined
  const conditionalRange: Record<string, unknown>[] = [
    ...((base.conditionalRange as unknown as Record<string, unknown>[] | undefined) ?? []),
  ]
  let flatDamageBlock: Record<string, unknown> | undefined = base.flatDamageBlock
    ? { ...(base.flatDamageBlock as Record<string, unknown>) }
    : undefined
  let shieldHitBlock: Record<string, unknown> | undefined = base.shieldHitBlock
    ? { ...(base.shieldHitBlock as Record<string, unknown>) }
    : undefined
  let targetPriorityProfile: string | undefined = base.targetPriorityProfile as string | undefined
  let conditionalAttackMode: Record<string, unknown> | undefined = base.conditionalAttackMode
    ? { ...(base.conditionalAttackMode as Record<string, unknown>) }
    : undefined
  let sweepAttack: Record<string, unknown> | undefined = base.sweepAttack
    ? { ...(base.sweepAttack as Record<string, unknown>) }
    : undefined
  let linePierce: Record<string, unknown> | undefined = base.linePierce
    ? { ...(base.linePierce as Record<string, unknown>) }
    : undefined
  let coneAttack: Record<string, unknown> | undefined = base.coneAttack
    ? { ...(base.coneAttack as Record<string, unknown>) }
    : undefined
  let beamAttack: Record<string, unknown> | undefined = base.beamAttack
    ? { ...(base.beamAttack as Record<string, unknown>) }
    : undefined
  let barrageAttack: Record<string, unknown> | undefined = base.barrageAttack
    ? { ...(base.barrageAttack as Record<string, unknown>) }
    : undefined
  let chainAttack: Record<string, unknown> | undefined = base.chainAttack
    ? { ...(base.chainAttack as Record<string, unknown>) }
    : undefined
  let splitFire: Record<string, unknown> | undefined = base.splitFire
    ? { ...(base.splitFire as Record<string, unknown>) }
    : undefined
  let sideWeapon: Record<string, unknown> | undefined = base.sideWeapon
    ? { ...(base.sideWeapon as Record<string, unknown>) }
    : undefined
  let stealthWhileMoving: boolean = base.stealthWhileMoving === true

  for (const upgradeId of upgradeIds) {
    const modifiers = upgradeRecord[upgradeId]?.modifiers as Record<string, unknown> | undefined
    if (!modifiers) continue

    if (modifiers.periodicAbilities && Array.isArray(modifiers.periodicAbilities)) {
      periodicAbilities.push(...(modifiers.periodicAbilities as Record<string, unknown>[]))
    }
    if (modifiers.triggerEffects && Array.isArray(modifiers.triggerEffects)) {
      triggerEffects.push(...(modifiers.triggerEffects as Record<string, unknown>[]).map(t => ({ ...t })))
    }
    if (modifiers.onDeathSpawn && typeof modifiers.onDeathSpawn === 'string') {
      triggerEffects.push({
        id: `${upgradeId}-on-death-spawn`,
        event: 'death',
        payload: { kind: 'spawn', target: 'self', unitType: modifiers.onDeathSpawn, count: 1, cap: 1 },
      })
    }
    if (modifiers.transformMode && Array.isArray(modifiers.transformMode)) {
      transformMode.push(...(modifiers.transformMode as Record<string, unknown>[]).map(m => ({ ...m })))
    }
    if (modifiers.fieldEffect && Array.isArray(modifiers.fieldEffect)) {
      fieldEffect.push(...(modifiers.fieldEffect as Record<string, unknown>[]).map(e => ({ ...e })))
    }
    if (modifiers.controlBeam) {
      controlBeam = { ...(modifiers.controlBeam as Record<string, unknown>) }
    }
    if (modifiers.formationModifiers) {
      formationModifiers = { ...(modifiers.formationModifiers as Record<string, unknown>) }
    }
    if (modifiers.statGrowth) {
      statGrowth = { ...(modifiers.statGrowth as Record<string, unknown>) }
    }
    if (modifiers.attackCharge) {
      attackCharge = { ...(modifiers.attackCharge as Record<string, unknown>) }
    }
    if (modifiers.reassembly) {
      reassembly = { ...(modifiers.reassembly as Record<string, unknown>) }
    }
    if (modifiers.rankScaling) {
      const rs = modifiers.rankScaling as RankScalingConfig
      rankScaling = { ...rs, damageModifiers: rs.damageModifiers?.map((m: { relation: 'same_rank' | 'higher_rank' | 'lower_rank'; multiplier: number }) => ({ ...m })) }
    }
    if (modifiers.conditionalRange && Array.isArray(modifiers.conditionalRange)) {
      conditionalRange.push(...(modifiers.conditionalRange as Record<string, unknown>[]).map(r => ({ ...r })))
    }
    if (modifiers.flatDamageBlock) {
      flatDamageBlock = { ...(modifiers.flatDamageBlock as Record<string, unknown>) }
    }
    if (modifiers.shieldHitBlock) {
      shieldHitBlock = { ...(modifiers.shieldHitBlock as Record<string, unknown>) }
    }
    if (modifiers.targetPriorityProfile && typeof modifiers.targetPriorityProfile === 'string') {
      targetPriorityProfile = modifiers.targetPriorityProfile
    }
    if (modifiers.conditionalAttackMode) {
      conditionalAttackMode = { ...(modifiers.conditionalAttackMode as Record<string, unknown>) }
    }
    if (modifiers.sweepAttack) {
      sweepAttack = { ...(modifiers.sweepAttack as Record<string, unknown>) }
    }
    if (modifiers.linePierce) {
      linePierce = { ...(modifiers.linePierce as Record<string, unknown>) }
    }
    if (modifiers.coneAttack) {
      coneAttack = { ...(modifiers.coneAttack as Record<string, unknown>) }
    }
    if (modifiers.beamAttack) {
      beamAttack = { ...(modifiers.beamAttack as Record<string, unknown>) }
    }
    if (modifiers.barrageAttack) {
      barrageAttack = { ...(modifiers.barrageAttack as Record<string, unknown>) }
    }
    if (modifiers.chainAttack) {
      chainAttack = { ...(modifiers.chainAttack as Record<string, unknown>) }
    }
    if (modifiers.splitFire) {
      splitFire = { ...(modifiers.splitFire as Record<string, unknown>) }
    }
    if (modifiers.sideWeapon) {
      sideWeapon = { ...(modifiers.sideWeapon as Record<string, unknown>) }
    }
    if (modifiers.stealthWhileMoving) {
      stealthWhileMoving = true
    }
  }

  return {
    periodicAbilities: periodicAbilities.length > 0 ? (periodicAbilities as unknown as PreparedStats['periodicAbilities']) : undefined,
    triggerEffects: triggerEffects.length > 0 ? (triggerEffects as unknown as PreparedStats['triggerEffects']) : undefined,
    transformMode: transformMode.length > 0 ? (transformMode as unknown as PreparedStats['transformMode']) : undefined,
    fieldEffect: fieldEffect.length > 0 ? (fieldEffect as unknown as PreparedStats['fieldEffect']) : undefined,
    controlBeam: controlBeam as unknown as PreparedStats['controlBeam'],
    formationModifiers: formationModifiers as unknown as PreparedStats['formationModifiers'],
    statGrowth: statGrowth as unknown as PreparedStats['statGrowth'],
    attackCharge: attackCharge as unknown as PreparedStats['attackCharge'],
    reassembly: reassembly as unknown as PreparedStats['reassembly'],
    rankScaling: rankScaling as unknown as PreparedStats['rankScaling'],
    conditionalRange: conditionalRange.length > 0 ? (conditionalRange as unknown as PreparedStats['conditionalRange']) : undefined,
    flatDamageBlock: flatDamageBlock as unknown as PreparedStats['flatDamageBlock'],
    shieldHitBlock: shieldHitBlock as unknown as PreparedStats['shieldHitBlock'],
    targetPriorityProfile: targetPriorityProfile as unknown as PreparedStats['targetPriorityProfile'],
    conditionalAttackMode: conditionalAttackMode as unknown as PreparedStats['conditionalAttackMode'],
    sweepAttack: sweepAttack as unknown as PreparedStats['sweepAttack'],
    linePierce: linePierce as unknown as PreparedStats['linePierce'],
    coneAttack: coneAttack as unknown as PreparedStats['coneAttack'],
    beamAttack: beamAttack as unknown as PreparedStats['beamAttack'],
    barrageAttack: barrageAttack as unknown as PreparedStats['barrageAttack'],
    chainAttack: chainAttack as unknown as PreparedStats['chainAttack'],
    splitFire: splitFire as unknown as PreparedStats['splitFire'],
    sideWeapon: sideWeapon as unknown as PreparedStats['sideWeapon'],
    stealthWhileMoving: stealthWhileMoving ? true : undefined,
  }
}

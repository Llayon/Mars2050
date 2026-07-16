import { getUnitSupportAuras } from './combat.auras'
import { UNIT_TYPES } from './combat.config'
import { applyRankScaling, getUnitRank } from './combat.rank-scaling'
import { getFormationSpacing, prepareRuntimePrimitives } from './combat.runtime-primitives'
import type { SimUnit, Team } from './combat.sim.types'
import type { UnitRow } from './combat.types'
import { getRuntimePrimitiveStats } from './combat.upgrade-primitives'
import { UPGRADES } from './combat.upgrades'
import { createRuntimeUnitFromConfig } from './combat.unit-factory'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from './combat.utils'
import { assertValidWeaponLoadout } from './combat.weapon-validation'

export function createRuntimeSquad(row: UnitRow, team: Team, rng: PRNG): SimUnit[] {
  const config = UNIT_TYPES[row.unit_type]
  if (!config) return []
  const squadSize = config.squadSize || 1
  const spacing = getFormationSpacing(config.squadSpacing || 20, config.baseStats)
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  if (row.grid_x == null) row.grid_x = String(Math.floor(rng.next() * FIELD_WIDTH))
  if (row.grid_y == null) row.grid_y = String(Math.floor(rng.next() * 320) + (team === 'attacker' ? FIELD_HEIGHT - 320 : 0))
  const centerX = Number(row.grid_x)
  const centerY = Number(row.grid_y)
  const squadId = squadSize > 1 ? `${row.id}_squad` : undefined
  const formation = config.formation || 'grid'
  let hp = config.baseStats.hp
  let attack = config.baseStats.attack
  let defense = config.baseStats.defense
  let speed = config.baseStats.speed * 15
  let range = config.baseStats.range * 40
  let cooldown = config.baseStats.actionCooldownMax || 10
  let canTargetAir = config.baseStats.canTargetAir || false
  let aoeRadius = config.baseStats.aoeRadius ? config.baseStats.aoeRadius * 40 : undefined
  let attackType = config.baseStats.attackType || 'single'
  let shield = 0
  let flying = config.baseStats.isFlying || false
  const modeSwitchConfig = config.baseStats.modeSwitch ? { ...config.baseStats.modeSwitch } : undefined
  let appliesEmp = false, leavesPuddle = false
  let spawnerConfig: { unitType: string; interval: number; timer: number } | undefined
  let movingReduction = 0
  let onDeathPuddle: 'napalm' | 'acid' | 'emp' | undefined
  let burrowConfig = config.baseStats.burrowWhileMoving ? { ...config.baseStats.burrowWhileMoving } : undefined
  let multishot = 1, antiAirDamageMult = config.baseStats.antiAirDamageMult ?? 1
  let replicateOnKill = false, resurrectOnce = false, stealthUntilAttack = false, executeThreshold = 0
  let lifestealMult = 0, groundDamageMult = 1, shieldDamageMult = config.baseStats.shieldDamageMult ?? 1
  let armorPierceRatio = config.baseStats.armorPierceRatio ?? 0
  let summonCounterDamageMult = config.baseStats.summonCounterDamageMult ?? 1
  let accuracyPenaltyResist = config.baseStats.accuracyPenaltyResist ?? 0
  const primitiveStats = getRuntimePrimitiveStats(config.baseStats, row.upgrade_path)
  assertValidWeaponLoadout(row.unit_type, primitiveStats)
  const rank = getUnitRank(row)

  for (const upgradeId of row.upgrade_path ?? []) {
    const modifiers = UPGRADES[upgradeId]?.modifiers
    if (!modifiers) continue
    if (modifiers.hpMult) hp *= modifiers.hpMult
    if (modifiers.attackMult) attack *= modifiers.attackMult
    if (modifiers.defenseAdd) defense += modifiers.defenseAdd
    if (modifiers.speedMult) speed *= modifiers.speedMult
    if (modifiers.rangeAdd) range += modifiers.rangeAdd * 40
    if (modifiers.cooldownMult) cooldown *= modifiers.cooldownMult
    if (modifiers.addFlying) flying = true
    if (modifiers.grantShield) shield += config.baseStats.hp * modifiers.grantShield
    if (modifiers.grantShieldFlat) shield += modifiers.grantShieldFlat
    if (modifiers.disableEnemyTech) appliesEmp = true
    if (modifiers.leaveAoePuddle) leavesPuddle = true
    if (modifiers.periodicSpawn) spawnerConfig = { unitType: modifiers.periodicSpawn.unit, interval: modifiers.periodicSpawn.interval * 10, timer: modifiers.periodicSpawn.interval * 10 }
    if (modifiers.onDeathPuddle) onDeathPuddle = modifiers.onDeathPuddle
    if (modifiers.replicateOnKill) replicateOnKill = true
    if (modifiers.resurrectOnce) resurrectOnce = true
    if (modifiers.stealthUntilAttack) stealthUntilAttack = true
    if (modifiers.executeThreshold) executeThreshold = modifiers.executeThreshold
    if (modifiers.lifestealMult) lifestealMult = modifiers.lifestealMult
    if (modifiers.groundDamageMult) groundDamageMult = modifiers.groundDamageMult
    if (modifiers.shieldDamageMult) shieldDamageMult *= modifiers.shieldDamageMult
    if (modifiers.armorPierceRatio !== undefined) armorPierceRatio = Math.max(armorPierceRatio, modifiers.armorPierceRatio)
    if (modifiers.summonCounterDamageMult) summonCounterDamageMult *= modifiers.summonCounterDamageMult
    if (modifiers.accuracyPenaltyResist !== undefined) accuracyPenaltyResist = Math.max(accuracyPenaltyResist, modifiers.accuracyPenaltyResist)
    if (modifiers.damageReductionWhileMoving) movingReduction = modifiers.damageReductionWhileMoving
    if (modifiers.burrowWhileMoving) burrowConfig = { ...modifiers.burrowWhileMoving }
    if (modifiers.multishot) multishot = modifiers.multishot
    if (modifiers.antiAirDamageMult) antiAirDamageMult = modifiers.antiAirDamageMult
    if (modifiers.grantAntiAir) canTargetAir = true
    if (modifiers.addAoE) {
      attackType = 'aoe'
      aoeRadius = (aoeRadius ?? 0) + modifiers.addAoE * 40
    }
  }

  const ranked = applyRankScaling({ hp, attack, defense, range, cooldown }, primitiveStats.rankScaling, rank)
  hp = ranked.hp; attack = ranked.attack; defense = ranked.defense; range = ranked.range; cooldown = ranked.cooldown
  const units: SimUnit[] = []
  for (let index = 0; index < squadSize; index++) {
    const offset = getFormationOffset(index, squadSize, rowSize, spacing, formation, team)
    const angle = team === 'attacker' ? Math.PI / 2 : -Math.PI / 2
    const unit = createRuntimeUnitFromConfig({
      id: squadSize > 1 ? `${row.id}_${index}` : row.id!, team, type: row.unit_type,
      x: centerX + offset.x, y: centerY + offset.y, currentAngle: angle,
    })
    if (!unit) continue
    Object.assign(unit, {
      squadId, rank, hp: row.hp_current !== undefined ? Math.min(row.hp_current, hp) : hp,
      maxHp: Math.round(hp), attack: Math.round(attack), defense, speed, range, attackType,
      spawnType: config.baseStats.spawnType, spawnCap: config.baseStats.spawnCap,
      actionCooldownMax: cooldown, actionCooldown: 0,
      isFlying: modeSwitchConfig ? (modeSwitchConfig.startMode ?? 'ground') === 'air' : flying,
      canTargetAir, turnSpeed: config.baseStats.turnSpeed || 0.5, currentAngle: angle, initialAngle: angle,
      size: config.baseStats.size || 'M', aoeRadius, shield: Math.round(shield), maxShield: Math.round(shield),
      statusEffects: [], statusOnHit: config.baseStats.statusOnHit?.map(status => ({ ...status })),
      markOnHit: config.baseStats.markOnHit ? { ...config.baseStats.markOnHit } : undefined,
      supportAuras: getUnitSupportAuras(config.baseStats.supportAuras, row.upgrade_path), appliesEmp, leavesPuddle,
      spawnerConfig: spawnerConfig ? { ...spawnerConfig } : undefined, damageReductionWhileMoving: movingReduction,
      burrowConfig: burrowConfig ? { ...burrowConfig } : undefined, isBurrowed: false, onDeathPuddle,
      multishot, antiAirDamageMult, replicateOnKill, resurrectOnce, stealthUntilAttack, executeThreshold,
      lifestealMult, groundDamageMult, shieldDamageMult,
      armorPierceRatio: armorPierceRatio || undefined,
      summonCounterDamageMult: summonCounterDamageMult === 1 ? undefined : summonCounterDamageMult,
      accuracyPenaltyResist: accuracyPenaltyResist || undefined,
      smokeOnAction: config.baseStats.smokeOnAction ? { ...config.baseStats.smokeOnAction } : undefined,
      stanceConfig: config.baseStats.stance ? { ...config.baseStats.stance } : undefined,
      stanceMode: config.baseStats.stance ? 'mobile' : undefined, stanceTicks: 0, modeSwitchConfig,
      mobilityMode: modeSwitchConfig ? (modeSwitchConfig.startMode ?? 'ground') : undefined,
      pullOnHit: config.baseStats.pullOnHit ? { radius: config.baseStats.pullOnHit.radius * 40, strength: config.baseStats.pullOnHit.strength * 40, maxTargets: config.baseStats.pullOnHit.maxTargets } : undefined,
      knockbackOnHit: config.baseStats.knockbackOnHit ? { radius: config.baseStats.knockbackOnHit.radius * 40, strength: config.baseStats.knockbackOnHit.strength * 40, maxTargets: config.baseStats.knockbackOnHit.maxTargets } : undefined,
      reactiveArmorCharges: config.baseStats.reactiveArmor?.charges, reactiveArmorBlock: config.baseStats.reactiveArmor?.block,
      damageShareRadius: config.baseStats.damageShare?.radius ? config.baseStats.damageShare.radius * 40 : undefined,
      damageShareRatio: config.baseStats.damageShare?.ratio, damageShareMaxTargets: config.baseStats.damageShare?.maxTargets,
      projectileInterceptRadius: config.baseStats.projectileInterception?.radius,
      projectileInterceptCooldownMax: config.baseStats.projectileInterception?.cooldownTicks,
      projectileInterceptCooldown: 0, projectileInterceptMaxDamage: config.baseStats.projectileInterception?.maxDamage,
      offsetX: offset.x, offsetY: offset.y, x: centerX + offset.x, y: centerY + offset.y,
      aggroLockTicks: 0, velocity: { x: 0, y: 0 }, isDead: false,
    })
    prepareRuntimePrimitives(unit, primitiveStats)
    units.push(unit)
  }
  return units
}

function getFormationOffset(index: number, squadSize: number, rowSize: number, spacing: number, formation: string, team: Team): { x: number; y: number } {
  let x = 0, y = 0
  if (formation === 'line') x = (index - (squadSize - 1) / 2) * spacing
  else if (formation === 'wedge') {
    if (index === 0) y = spacing
    else {
      const rank = Math.ceil(index / 2)
      x = (index % 2 === 0 ? 1 : -1) * rank * spacing
      y = spacing - rank * spacing
    }
  } else {
    const row = Math.floor(index / rowSize), column = index % rowSize
    x = (column - (rowSize - 1) / 2) * spacing
    y = (row - (Math.ceil(squadSize / rowSize) - 1) / 2) * spacing
  }
  return { x, y: y * (team === 'attacker' ? 1 : -1) }
}

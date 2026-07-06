import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitBaseStats, UnitTypeConfig } from '@/domains/combat/combat.types'

function hasShieldBehavior(stats: UnitBaseStats): boolean {
  return (stats.supportAuras ?? []).some(aura => aura.type === 'shield')
}

function hasUtilityBehavior(stats: UnitBaseStats): boolean {
  return stats.attackType === 'spawn'
    || stats.attackType === 'heal'
    || (stats.statusOnHit?.length ?? 0) > 0
    || stats.markOnHit !== undefined
    || (stats.supportAuras?.length ?? 0) > 0
    || stats.mineOnAction !== undefined
    || stats.smokeOnAction !== undefined
    || stats.pullOnHit !== undefined
    || stats.knockbackOnHit !== undefined
    || stats.stance !== undefined
    || stats.modeSwitch !== undefined
    || stats.projectileInterception !== undefined
}

describe('combat unit config contract', () => {
  it('keeps attack type configs complete', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      const stats = config.baseStats

      if (stats.attackType === 'aoe') {
        expect(stats.aoeRadius, `${unitType} uses aoe without aoeRadius`).toBeGreaterThan(0)
      }
      if (stats.attackType === 'spawn') {
        expect(stats.spawnType, `${unitType} uses spawn without spawnType`).toBeTruthy()
        expect(stats.spawnCap, `${unitType} uses spawn without positive spawnCap`).toBeGreaterThan(0)
      }
      if (stats.attackType === 'heal') {
        expect(stats.attack, `${unitType} uses heal without positive heal amount`).toBeGreaterThan(0)
      }
      if (stats.reactiveArmor) {
        expect(stats.reactiveArmor.charges, `${unitType} has reactive armor without positive charges`).toBeGreaterThan(0)
        expect(stats.reactiveArmor.block, `${unitType} has reactive armor without positive block`).toBeGreaterThan(0)
      }
      if (stats.damageShare) {
        expect(stats.damageShare.radius, `${unitType} has damage share without positive radius`).toBeGreaterThan(0)
        expect(stats.damageShare.ratio, `${unitType} has damage share without positive ratio`).toBeGreaterThan(0)
        expect(stats.damageShare.ratio, `${unitType} has damage share ratio above safety cap`).toBeLessThanOrEqual(0.9)
        if (stats.damageShare.maxTargets !== undefined) {
          expect(stats.damageShare.maxTargets, `${unitType} has damage share without positive maxTargets`).toBeGreaterThan(0)
        }
      }
      if (stats.markOnHit) {
        expect(stats.markOnHit.duration, `${unitType} has target mark without positive duration`).toBeGreaterThan(0)
        expect((stats.markOnHit.damageMultiplier ?? 0) + (stats.markOnHit.executeThreshold ?? 0), `${unitType} has target mark without effect`).toBeGreaterThan(0)
      }
      if (stats.coneAttack) {
        expect(stats.coneAttack.angleDeg, `${unitType} has cone attack without positive angle`).toBeGreaterThan(0)
        expect(stats.coneAttack.angleDeg, `${unitType} has cone attack above 180 degrees`).toBeLessThanOrEqual(180)
        expect(stats.coneAttack.damageMultiplier, `${unitType} has cone attack without positive damage`).toBeGreaterThan(0)
      }
      if (stats.beamAttack) {
        expect(stats.beamAttack.width, `${unitType} has beam attack without positive width`).toBeGreaterThan(0)
        expect(stats.beamAttack.damageMultiplier, `${unitType} has beam attack without positive damage`).toBeGreaterThan(0)
      }
      if (stats.minimumRange !== undefined) {
        expect(stats.minimumRange, `${unitType} has negative minimum range`).toBeGreaterThanOrEqual(0)
        expect(stats.minimumRange, `${unitType} has minimum range greater than or equal to range`).toBeLessThan(stats.range)
      }
      if (stats.barrageAttack) {
        expect(stats.barrageAttack.impacts, `${unitType} has barrage without positive impacts`).toBeGreaterThan(0)
        expect(stats.barrageAttack.radius, `${unitType} has barrage without positive radius`).toBeGreaterThan(0)
        expect(stats.barrageAttack.spreadRadius, `${unitType} has barrage with negative spread`).toBeGreaterThanOrEqual(0)
        expect(stats.barrageAttack.damageMultiplier, `${unitType} has barrage without positive damage`).toBeGreaterThan(0)
      }
      if (stats.chainAttack) {
        expect(stats.chainAttack.jumps, `${unitType} has chain attack without positive jumps`).toBeGreaterThan(0)
        expect(stats.chainAttack.radius, `${unitType} has chain attack without positive radius`).toBeGreaterThan(0)
        expect(stats.chainAttack.damageMultiplier, `${unitType} has chain attack without positive damage`).toBeGreaterThan(0)
        if (stats.chainAttack.falloff !== undefined) {
          expect(stats.chainAttack.falloff, `${unitType} has chain attack without positive falloff`).toBeGreaterThan(0)
        }
      }
      if (stats.splitFire) {
        expect(stats.splitFire.maxTargets, `${unitType} has split fire without positive maxTargets`).toBeGreaterThan(0)
        expect(stats.splitFire.damageMultiplier, `${unitType} has split fire without positive damage`).toBeGreaterThan(0)
        if (stats.splitFire.range !== undefined) {
          expect(stats.splitFire.range, `${unitType} has split fire without positive range`).toBeGreaterThan(0)
        }
      }
      if (stats.sideWeapon) {
        expect(stats.sideWeapon.damage, `${unitType} has side weapon without positive damage`).toBeGreaterThan(0)
        expect(stats.sideWeapon.range, `${unitType} has side weapon without positive range`).toBeGreaterThan(0)
        expect(stats.sideWeapon.maxTargets, `${unitType} has side weapon without positive maxTargets`).toBeGreaterThan(0)
      }
      if (stats.rampDamage) {
        expect(stats.rampDamage.step, `${unitType} has ramp damage without positive step`).toBeGreaterThan(0)
        expect(stats.rampDamage.maxMultiplier, `${unitType} has ramp damage without useful max multiplier`).toBeGreaterThan(1)
      }
      if (stats.chargeDamage) {
        expect(stats.chargeDamage.minDistance, `${unitType} has charge damage with negative min distance`).toBeGreaterThanOrEqual(0)
        expect(stats.chargeDamage.maxDistance, `${unitType} has charge damage without useful max distance`).toBeGreaterThan(stats.chargeDamage.minDistance)
        expect(stats.chargeDamage.maxMultiplier, `${unitType} has charge damage without useful multiplier`).toBeGreaterThan(1)
      }
      if (stats.percentHpDamage) {
        expect(stats.percentHpDamage.percent, `${unitType} has percent HP damage without positive percent`).toBeGreaterThan(0)
        expect(stats.percentHpDamage.percent, `${unitType} has percent HP damage above 100%`).toBeLessThanOrEqual(1)
        expect(stats.percentHpDamage.maxBonus, `${unitType} has percent HP damage without positive cap`).toBeGreaterThan(0)
        expect(['max', 'current', undefined], `${unitType} has invalid percent HP damage basis`).toContain(stats.percentHpDamage.basis)
        if (stats.percentHpDamage.minBonus !== undefined) {
          expect(stats.percentHpDamage.minBonus, `${unitType} has percent HP damage with negative minimum`).toBeGreaterThanOrEqual(0)
        }
      }
      if (stats.shieldDamageMult !== undefined) {
        expect(stats.shieldDamageMult, `${unitType} has shield damage multiplier below baseline`).toBeGreaterThanOrEqual(1)
      }
      if (stats.armorPierceRatio !== undefined) {
        expect(stats.armorPierceRatio, `${unitType} has negative armor pierce ratio`).toBeGreaterThanOrEqual(0)
        expect(stats.armorPierceRatio, `${unitType} has armor pierce ratio above 100%`).toBeLessThanOrEqual(1)
      }
      if (stats.summonCounterDamageMult !== undefined) {
        expect(stats.summonCounterDamageMult, `${unitType} has summon counter multiplier below baseline`).toBeGreaterThanOrEqual(1)
      }
      if (stats.healTargetTags) {
        expect(stats.attackType, `${unitType} has heal target tags without heal attack type`).toBe('heal')
        expect(stats.healTargetTags.length, `${unitType} has empty heal target tag list`).toBeGreaterThan(0)
      }
      if (stats.projectileInterception) {
        expect(stats.projectileInterception.radius, `${unitType} has projectile interception without positive radius`).toBeGreaterThan(0)
        expect(stats.projectileInterception.cooldownTicks, `${unitType} has projectile interception without positive cooldown`).toBeGreaterThan(0)
        if (stats.projectileInterception.maxDamage !== undefined) {
          expect(stats.projectileInterception.maxDamage, `${unitType} has projectile interception without positive max damage`).toBeGreaterThan(0)
        }
      }
      if (stats.smokeOnAction) {
        expect(stats.smokeOnAction.radius, `${unitType} has smoke without positive radius`).toBeGreaterThan(0)
        expect(stats.smokeOnAction.duration, `${unitType} has smoke without positive duration`).toBeGreaterThan(0)
        expect((stats.smokeOnAction.rangeSuppression ?? 0) + (stats.smokeOnAction.outputSuppression ?? 0) + (stats.smokeOnAction.accuracySuppression ?? 0), `${unitType} has smoke without suppression effect`).toBeGreaterThan(0)
      }
      if (stats.pullOnHit) {
        expect(stats.pullOnHit.radius, `${unitType} has pull without positive radius`).toBeGreaterThan(0)
        expect(stats.pullOnHit.strength, `${unitType} has pull without positive strength`).toBeGreaterThan(0)
        if (stats.pullOnHit.maxTargets !== undefined) {
          expect(stats.pullOnHit.maxTargets, `${unitType} has pull without positive maxTargets`).toBeGreaterThan(0)
        }
      }
      if (stats.knockbackOnHit) {
        expect(stats.knockbackOnHit.radius, `${unitType} has knockback without positive radius`).toBeGreaterThan(0)
        expect(stats.knockbackOnHit.strength, `${unitType} has knockback without positive strength`).toBeGreaterThan(0)
        if (stats.knockbackOnHit.maxTargets !== undefined) {
          expect(stats.knockbackOnHit.maxTargets, `${unitType} has knockback without positive maxTargets`).toBeGreaterThan(0)
        }
      }
      if (stats.stance) {
        expect(['siege', 'entrenched'], `${unitType} has invalid stance mode`).toContain(stats.stance.mode)
        expect(stats.stance.deployTicks, `${unitType} has stance without non-negative deployTicks`).toBeGreaterThanOrEqual(0)
        expect(stats.stance.rangeMultiplier ?? 1, `${unitType} has stance without positive range multiplier`).toBeGreaterThan(0)
        expect(stats.stance.cooldownMultiplier ?? 1, `${unitType} has stance without positive cooldown multiplier`).toBeGreaterThan(0)
        expect(stats.stance.speedMultiplier ?? 1, `${unitType} has stance with negative speed multiplier`).toBeGreaterThanOrEqual(0)
      }
      if (stats.modeSwitch) {
        expect(stats.modeSwitch.trigger, `${unitType} has invalid mode switch trigger`).toBe('while_moving')
        expect(['ground', 'air', undefined], `${unitType} has invalid initial mobility mode`).toContain(stats.modeSwitch.startMode)
        expect(stats.modeSwitch.airSpeedMultiplier ?? 1, `${unitType} has mode switch without positive air speed multiplier`).toBeGreaterThan(0)
        expect(stats.modeSwitch.groundSpeedMultiplier ?? 1, `${unitType} has mode switch without positive ground speed multiplier`).toBeGreaterThan(0)
      }
      if (stats.burrowWhileMoving) {
        expect(stats.burrowWhileMoving.damageReduction, `${unitType} has burrow without positive damage reduction`).toBeGreaterThan(0)
        expect(stats.burrowWhileMoving.damageReduction, `${unitType} has burrow damage reduction above safety cap`).toBeLessThanOrEqual(0.9)
      }
      if (stats.onKill) {
        expect(Boolean(stats.onKill.cooldownReset || stats.onKill.healPercent || stats.onKill.status), `${unitType} has on-kill without an effect`).toBe(true)
        if (stats.onKill.healPercent !== undefined) {
          expect(stats.onKill.healPercent, `${unitType} has on-kill heal without positive percent`).toBeGreaterThan(0)
          expect(stats.onKill.healPercent, `${unitType} has on-kill heal above 100%`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('requires gameplay tags to match implemented mechanics', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      const tags = new Set(config.baseStats.combatTags ?? [])
      const stats = config.baseStats

      if (tags.has('shielded')) {
        expect(hasShieldBehavior(stats), `${unitType} is tagged shielded without shield behavior`).toBe(true)
      }
      if (tags.has('healer')) {
        expect(stats.attackType === 'heal' || (stats.supportAuras ?? []).some(aura => aura.type === 'regen'), `${unitType} is tagged healer without heal/regen behavior`).toBe(true)
      }
      if (tags.has('summoner')) {
        expect(stats.attackType, `${unitType} is tagged summoner without spawn attack type`).toBe('spawn')
        expect(stats.spawnType, `${unitType} is tagged summoner without spawnType`).toBeTruthy()
        expect(stats.spawnCap, `${unitType} is tagged summoner without positive spawnCap`).toBeGreaterThan(0)
      }
    }
  })

  it('does not allow mobile zero-damage units without a utility effect', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      const stats = config.baseStats
      const tags = new Set(stats.combatTags ?? [])
      const isStaticBlocker = tags.has('structure') || stats.speed === 0

      if (stats.attack > 0 || isStaticBlocker) continue

      expect(hasUtilityBehavior(stats), `${unitType} has zero attack and no utility behavior`).toBe(true)
    }
  })

  it('keeps support aura configs complete', () => {
    for (const [unitType, config] of Object.entries(UNIT_TYPES) as [string, UnitTypeConfig][]) {
      for (const aura of config.baseStats.supportAuras ?? []) {
        expect(aura.radius, `${unitType} has support aura without positive radius`).toBeGreaterThan(0)
        expect(['allies', 'enemies'], `${unitType} has support aura with invalid target`).toContain(aura.target)
        if (aura.interval !== undefined) {
          expect(aura.interval, `${unitType} has support aura without positive interval`).toBeGreaterThan(0)
        }
        if (['shield', 'shield_repair', 'regen', 'damage_reduction', 'haste', 'range_boost'].includes(aura.type)) {
          expect(aura.value, `${unitType} has ${aura.type} aura without positive value`).toBeGreaterThan(0)
        }
        if (aura.targetTags) {
          expect(aura.targetTags.length, `${unitType} has support aura with empty targetTags`).toBeGreaterThan(0)
        }
        if (aura.type === 'status_immunity') {
          expect(aura.duration, `${unitType} has status immunity aura without explicit duration`).toBeGreaterThan(0)
        }
      }
    }
  })
})

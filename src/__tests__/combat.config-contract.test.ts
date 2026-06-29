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
    || stats.pullOnHit !== undefined
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
        if (['shield', 'regen', 'damage_reduction'].includes(aura.type)) {
          expect(aura.value, `${unitType} has ${aura.type} aura without positive value`).toBeGreaterThan(0)
        }
        if (aura.type === 'status_immunity') {
          expect(aura.duration, `${unitType} has status immunity aura without explicit duration`).toBeGreaterThan(0)
        }
      }
    }
  })
})

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
      }
      if (stats.attackType === 'heal') {
        expect(stats.attack, `${unitType} uses heal without positive heal amount`).toBeGreaterThan(0)
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
})

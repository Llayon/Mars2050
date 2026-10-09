import type { UnitDefinition } from '@mars2050/combat-core/contracts'
import { UNIT_TYPES } from './combat.config'

import type { UnitTypeConfig } from './combat.types'

/**
 * Converts Mars UNIT_TYPES into clean UnitDefinition dictionary for combat-core.
 */
export function buildMarsUnitDefinitions(rawTypes?: Record<string, UnitTypeConfig>): Record<string, UnitDefinition> {
  const source = rawTypes ?? UNIT_TYPES
  const definitions: Record<string, UnitDefinition> = {}
  for (const [key, cfg] of Object.entries(source)) {
    const rawStats = cfg.baseStats as Record<string, unknown>
    const delivery = rawStats.delivery as { interceptable?: boolean } | undefined
    const isInterceptable = cfg.baseStats.projectileInterceptable ?? (
      Boolean(cfg.baseStats.barrageAttack) ||
      Boolean(delivery?.interceptable) ||
      Boolean(cfg.baseStats.combatTags?.includes('explosive') && cfg.baseStats.range * 40 > 80 && cfg.baseStats.attack > 0)
    )
    const pullOnHit = rawStats.pullOnHit as { radius: number; strength: number } | undefined
    const knockbackOnHit = rawStats.knockbackOnHit as { radius: number; strength: number } | undefined
    const damageShare = rawStats.damageShare as { radius: number } | undefined
    const sideWeapon = rawStats.sideWeapon as { range: number } | undefined
    const splitFire = rawStats.splitFire as { range?: number } | undefined
    const abilities = Array.isArray(cfg.baseStats.abilities) ? (cfg.baseStats.abilities as unknown[]) : undefined

    definitions[key] = {
      id: key,
      name: cfg.name,
      baseStats: {
        ...cfg.baseStats,
        speed: cfg.baseStats.speed * 15,
        range: cfg.baseStats.range * 40,
        minimumRange: cfg.baseStats.minimumRange != null ? cfg.baseStats.minimumRange * 40 : undefined,
        aoeRadius: cfg.baseStats.aoeRadius != null ? cfg.baseStats.aoeRadius * 40 : undefined,
        pullOnHit: pullOnHit ? {
          ...pullOnHit,
          radius: pullOnHit.radius * 40,
          strength: pullOnHit.strength * 40,
        } : undefined,
        knockbackOnHit: knockbackOnHit ? {
          ...knockbackOnHit,
          radius: knockbackOnHit.radius * 40,
          strength: knockbackOnHit.strength * 40,
        } : undefined,
        damageShare: damageShare ? {
          ...damageShare,
          radius: damageShare.radius * 40,
        } : undefined,
        sideWeapon: sideWeapon ? {
          ...sideWeapon,
          range: sideWeapon.range * 40,
        } : undefined,
        splitFire: splitFire ? {
          ...splitFire,
          range: splitFire.range != null ? splitFire.range * 40 : undefined,
        } : undefined,
        velocityDamping: cfg.baseStats.velocityDamping ?? (cfg.baseStats.range * 40 > 60 || undefined),
        attackType: cfg.baseStats.attackType || 'single',
        actionCooldownMax: cfg.baseStats.actionCooldownMax || 10,
        turnSpeed: cfg.baseStats.turnSpeed ?? 5,
        size: cfg.baseStats.size ?? 'M',
        combatTags: cfg.baseStats.combatTags ? [...cfg.baseStats.combatTags] : [],
        projectileInterceptable: isInterceptable,
      },
      squadSize: cfg.squadSize ?? 1,
      squadSpacing: cfg.squadSpacing ?? 20,
      formation: cfg.formation ?? 'grid',
      targetingProfile: cfg.baseStats.targetingProfile,
      abilities: abilities ? [...abilities] : undefined,
    }
  }
  return definitions
}

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
    const isInterceptable = cfg.baseStats.projectileInterceptable ?? (
      Boolean(cfg.baseStats.barrageAttack) ||
      Boolean(cfg.baseStats.delivery && 'interceptable' in cfg.baseStats.delivery && cfg.baseStats.delivery.interceptable) ||
      Boolean(cfg.baseStats.combatTags?.includes('explosive') && cfg.baseStats.range * 40 > 80 && cfg.baseStats.attack > 0)
    )
    definitions[key] = {
      id: key,
      name: cfg.name,
      baseStats: {
        ...cfg.baseStats,
        speed: cfg.baseStats.speed * 15,
        range: cfg.baseStats.range * 40,
        minimumRange: cfg.baseStats.minimumRange != null ? cfg.baseStats.minimumRange * 40 : undefined,
        aoeRadius: cfg.baseStats.aoeRadius != null ? cfg.baseStats.aoeRadius * 40 : undefined,
        pullOnHit: cfg.baseStats.pullOnHit ? {
          ...cfg.baseStats.pullOnHit,
          radius: cfg.baseStats.pullOnHit.radius * 40,
          strength: cfg.baseStats.pullOnHit.strength * 40,
        } : undefined,
        knockbackOnHit: cfg.baseStats.knockbackOnHit ? {
          ...cfg.baseStats.knockbackOnHit,
          radius: cfg.baseStats.knockbackOnHit.radius * 40,
          strength: cfg.baseStats.knockbackOnHit.strength * 40,
        } : undefined,
        damageShare: cfg.baseStats.damageShare ? {
          ...cfg.baseStats.damageShare,
          radius: cfg.baseStats.damageShare.radius * 40,
        } : undefined,
        sideWeapon: cfg.baseStats.sideWeapon ? {
          ...cfg.baseStats.sideWeapon,
          range: cfg.baseStats.sideWeapon.range * 40,
        } : undefined,
        splitFire: cfg.baseStats.splitFire ? {
          ...cfg.baseStats.splitFire,
          range: cfg.baseStats.splitFire.range != null ? cfg.baseStats.splitFire.range * 40 : undefined,
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
      abilities: cfg.baseStats.abilities ? [...cfg.baseStats.abilities] as unknown[] : undefined,
    }
  }
  return definitions
}

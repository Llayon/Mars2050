import type { UnitDefinition } from '@mars2050/combat-core/contracts'
import { UNIT_TYPES } from './combat.config'

/**
 * Converts Mars UNIT_TYPES into clean UnitDefinition dictionary for combat-core.
 */
export function buildMarsUnitDefinitions(): Record<string, UnitDefinition> {
  const definitions: Record<string, UnitDefinition> = {}
  for (const [key, cfg] of Object.entries(UNIT_TYPES)) {
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
        attackType: cfg.baseStats.attackType || 'single',
        actionCooldownMax: cfg.baseStats.actionCooldownMax || 10,
        turnSpeed: cfg.baseStats.turnSpeed ?? 5,
        size: cfg.baseStats.size ?? 'M',
        combatTags: cfg.baseStats.combatTags ? [...cfg.baseStats.combatTags] : [],
        projectileInterceptable: isInterceptable || undefined,
      },
      squadSize: cfg.squadSize ?? 1,
      squadSpacing: cfg.squadSpacing ?? 20,
      formation: cfg.formation ?? 'grid',
      targetingProfile: cfg.baseStats.targetingProfile,
      abilities: cfg.baseStats.abilities ? [...cfg.baseStats.abilities] : undefined,
    }
  }
  return definitions
}

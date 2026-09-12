import type { UnitDefinition } from '@mars2050/combat-core/contracts'
import { UNIT_TYPES } from './combat.config'

/**
 * Converts Mars UNIT_TYPES into clean UnitDefinition dictionary for combat-core.
 */
export function buildMarsUnitDefinitions(): Record<string, UnitDefinition> {
  const definitions: Record<string, UnitDefinition> = {}
  for (const [key, cfg] of Object.entries(UNIT_TYPES)) {
    definitions[key] = {
      id: key,
      name: cfg.name,
      baseStats: {
        hp: cfg.baseStats.hp,
        attack: cfg.baseStats.attack,
        defense: cfg.baseStats.defense,
        speed: cfg.baseStats.speed,
        range: cfg.baseStats.range,
        attackType: cfg.baseStats.attackType || 'single',
        actionCooldownMax: cfg.baseStats.actionCooldownMax || 10,
        turnSpeed: cfg.baseStats.turnSpeed ?? 5,
        size: cfg.baseStats.size ?? 'M',
        combatTags: cfg.baseStats.combatTags ? [...cfg.baseStats.combatTags] : [],
        spawnType: cfg.baseStats.spawnType,
        spawnCap: cfg.baseStats.spawnCap,
      },
      squadSize: cfg.squadSize || 1,
      squadSpacing: cfg.squadSpacing || 20,
      formation: cfg.formation || 'grid',
    }
  }
  return definitions
}

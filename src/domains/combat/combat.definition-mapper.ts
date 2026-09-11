import type { UnitDefinition } from '@mars2050/combat-core/contracts'
import type { CombatTag } from './combat.sim.types'
import type { UnitBaseStats, UnitTypeConfig } from './combat.types'

/**
 * Converts a public contract UnitDefinition into internal UnitTypeConfig.
 */
export function mapDefinitionToUnitTypeConfig(def: UnitDefinition): UnitTypeConfig {
  const attackType: UnitBaseStats['attackType'] =
    def.baseStats.attackType === 'aoe'
      ? 'aoe'
      : def.baseStats.attackType === 'spawn'
        ? 'spawn'
        : def.baseStats.attackType === 'heal'
          ? 'heal'
          : 'single'
  return {
    name: def.name,
    baseStats: {
      hp: def.baseStats.hp,
      attack: def.baseStats.attack,
      defense: def.baseStats.defense,
      speed: def.baseStats.speed,
      range: def.baseStats.range,
      attackType,
      spawnType: def.baseStats.spawnType,
      spawnCap: def.baseStats.spawnCap,
      actionCooldownMax: def.baseStats.actionCooldownMax,
      turnSpeed: def.baseStats.turnSpeed,
      size: def.baseStats.size,
      combatTags: def.baseStats.combatTags ? ([...def.baseStats.combatTags] as CombatTag[]) : [],
    },
    hireCost: {},
    squadSize: def.squadSize,
    squadSpacing: def.squadSpacing,
    formation: def.formation,
  }
}

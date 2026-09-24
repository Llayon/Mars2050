import type { UnitDefinition } from './contracts/index.js'
import type { CombatTag } from './combat.sim.types.js'
import type { TargetingProfile, UnitBaseStats, UnitTypeConfig } from './combat.types.js'
import { CombatDefinitionError } from './combat.definition-error.js'

/**
 * Converts a public contract UnitDefinition into internal UnitTypeConfig.
 * Every accepted field is carried through; beam/spread have no runtime
 * representation and are rejected explicitly instead of coerced to single.
 */
export function mapDefinitionToUnitTypeConfig(def: UnitDefinition): UnitTypeConfig {
  const attackType = def.baseStats.attackType
  if (attackType !== 'single' && attackType !== 'aoe' && attackType !== 'spawn' && attackType !== 'heal') {
    throw new CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE', def.id, attackType)
  }
  const executableType: UnitBaseStats['attackType'] = attackType
  return {
    name: def.name,
    baseStats: {
      hp: def.baseStats.hp,
      attack: def.baseStats.attack,
      defense: def.baseStats.defense,
      speed: def.baseStats.speed,
      range: def.baseStats.range,
      attackType: executableType,
      spawnType: def.baseStats.spawnType,
      spawnCap: def.baseStats.spawnCap,
      statusOnHit: def.baseStats.statusOnHit?.map(status => ({ ...status })),
      healTargetTags: def.baseStats.healTargetTags ? ([...def.baseStats.healTargetTags] as CombatTag[]) : undefined,
      actionCooldownMax: def.baseStats.actionCooldownMax,
      turnSpeed: def.baseStats.turnSpeed,
      size: def.baseStats.size,
      combatTags: def.baseStats.combatTags ? ([...def.baseStats.combatTags] as CombatTag[]) : [],
      targetingProfile: (def.targetingProfile ?? def.baseStats.targetingProfile) as TargetingProfile | undefined,
    },
    hireCost: {},
    squadSize: def.squadSize,
    squadSpacing: def.squadSpacing,
    formation: def.formation,
  }
}

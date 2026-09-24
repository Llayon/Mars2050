import type { UnitDefinition } from './contracts/index.js'
import type { CombatTag, PeriodicAbilityConfig } from './combat.sim.types.js'
import type { AbilityDefinition } from './combat.ability.types.js'
import type { TargetingProfile, UnitBaseStats, UnitTypeConfig } from './combat.types.js'
import { CombatDefinitionError } from './combat.definition-error.js'

/**
 * Converts a public contract UnitDefinition into internal UnitTypeConfig.
 * All supported fields (abilities, periodicAbilities, geometries, passives) are carried through;
 * beam/spread have no runtime representation and are rejected explicitly instead of coerced.
 */
export function mapDefinitionToUnitTypeConfig(def: UnitDefinition): UnitTypeConfig {
  const attackType = def.baseStats.attackType
  if (attackType !== 'single' && attackType !== 'aoe' && attackType !== 'spawn' && attackType !== 'heal') {
    throw new CombatDefinitionError('UNSUPPORTED_ATTACK_TYPE', def.id, attackType)
  }
  const executableType: UnitBaseStats['attackType'] = attackType
  const rawBase = def.baseStats as Record<string, unknown>
  const rawDef = def as Record<string, unknown>

  const authoredAbilities = (def.abilities ?? rawBase.abilities) as AbilityDefinition[] | undefined
  const authoredPeriodic = (rawDef.periodicAbilities ?? rawBase.periodicAbilities) as PeriodicAbilityConfig[] | undefined

  const baseStats: UnitBaseStats = {
    ...rawBase,
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
    abilities: authoredAbilities?.map(a => ({ ...a })),
    periodicAbilities: authoredPeriodic?.map(p => ({ ...p })),
  } as unknown as UnitBaseStats

  return {
    name: def.name,
    baseStats,
    hireCost: {},
    squadSize: def.squadSize,
    squadSpacing: def.squadSpacing,
    formation: def.formation,
  }
}

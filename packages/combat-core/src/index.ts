export * from './contracts/index.js'
export * from './replay/index.js'
export * from './math/index.js'
export * from './facade/combat-facade.js'
export * from './combat.catalog.types.js'
export * from './combat.definition-error.js'
export * from './combat.input-validator.js'
export * from './combat.periodic-schema.js'
export * from './combat.definition-validator.js'
export { calculateEffectiveMaxHp, calculateEffectiveUnitStats } from './combat.unit-stat-compiler.js'
export { assertFiniteUnitStats, validateLateSpawnConfig, validateUnitLoadout, validateDefinitionBaseLoadout } from './combat.loadout-validator.js'
export { resolveEffectiveUnitBaseStats, mergePreparedStats } from './combat.effective-loadout.js'
export { getUnitSupportAuras } from './combat.support-aura-config.js'
export {
  statusAbility,
  markAbility,
  auraAbility,
  extractSupportAuras,
  periodicAbility,
  displaceAbility,
  splitFireAbility,
  chainAttackAbility,
  sideWeaponAbility,
  barrageAbility,
  linePierceAbility,
  coneAttackAbility,
  beamAttackAbility,
} from './combat.ability-config.js'
export type { AbilityDefinition } from './combat.ability.types.js'
export { mapDefinitionToUnitTypeConfig } from './combat.definition-mapper.js'
export { getUnitRank, applyRankScaling, type RankScaledStats } from './combat.rank-scaling.js'
export { getRuntimePrimitiveStats } from './combat.upgrade-primitives.js'
export type { UnitBaseStats, UnitTypeConfig } from './combat.types.js'
export type { CombatMetrics, BattleSimulationOptions } from './combat.metrics.js'
export type { MarkCombatMetrics } from './combat.mark-metrics.js'
export type { PeriodicAbilityConfig, PeriodicAbilityPayload, TriggerEffectConfig } from './combat.primitives.js'
export { compileUnitSnapshot } from './combat.unit-compiler.js'
export { createRuntimeUnitFromConfig, cloneRuntimeUnit, type RuntimeUnitFactoryInput } from './combat.unit-factory.js'
export { createSquadBuildSpecs } from './combat.squad-compiler.js'
export type { UnitBuildSpec } from './combat.unit-build.types.js'
export type { SimUnit, SimHazard, Obstacle } from './combat.sim.types.js'

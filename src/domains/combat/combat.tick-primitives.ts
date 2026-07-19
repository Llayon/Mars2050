import type { BattleAction } from './combat.actions'
import { processSupportAuras } from './combat.auras'
import { processGlobals } from './combat.globals'
import { processPeriodicAbilities } from './combat.periodic-abilities'
import { handleDeath } from './combat.systems.utils'
import { processHpThresholdTriggers, type TriggerContext } from './combat.triggers'
import type { GlobalUpgradeConfig } from './combat.upgrades'
import type { SimHazard, SimUnit, Team } from './combat.sim.types'
import type { PRNG } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

export interface PreActionRuntimePhases {
  runGrowthAndCharge(): void
  runBurrowRegeneration(): void
  runTransformModes(): void
  runFieldEffects(): void
  runFormationBonuses(): void
  runControlBeams(): void
}

export function processPreActionPrimitives(
  tick: number,
  activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[],
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG,
  runtimePhases: PreActionRuntimePhases,
  spatialHash?: SpatialHash,
): TriggerContext {
  const triggerContext = { units, hazards, actions, rng, tick, onUnitDeath: (target: SimUnit, source: SimUnit) => handleDeath(target, source, units, actions, hazards, rng) }
  processGlobals(tick, activeGlobals, units, hazards, actions, rng)
  processSupportAuras(tick, units, actions, spatialHash)
  runtimePhases.runGrowthAndCharge()
  runtimePhases.runBurrowRegeneration()
  runtimePhases.runTransformModes()
  runtimePhases.runFieldEffects()
  runtimePhases.runFormationBonuses()
  runtimePhases.runControlBeams()
  processPeriodicAbilities(tick, triggerContext)
  return triggerContext
}

export function processPostHazardPrimitives(units: SimUnit[], triggerContext: TriggerContext): void {
  const ordered = units.filter(unit => !unit.isDead).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) processHpThresholdTriggers(unit, triggerContext)
}

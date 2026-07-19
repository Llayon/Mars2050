import type { BattleAction } from './combat.actions'
import { processSupportAuras } from './combat.auras'
import { handleDeath } from './combat.systems.utils'
import { processHpThresholdTriggers, type TriggerContext } from './combat.triggers'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { PRNG } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

export interface PreActionRuntimePhases {
  runGlobals(): void
  runGrowthAndCharge(): void
  runBurrowRegeneration(): void
  runTransformModes(): void
  runFieldEffects(): void
  runFormationBonuses(): void
  runControlBeams(): void
  runPeriodicAbilities(): void
}

export function processPreActionPrimitives(
  tick: number,
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG,
  runtimePhases: PreActionRuntimePhases,
  spatialHash?: SpatialHash,
): TriggerContext {
  const triggerContext = { units, hazards, actions, rng, tick, onUnitDeath: (target: SimUnit, source: SimUnit) => handleDeath(target, source, units, actions, hazards, rng) }
  runtimePhases.runGlobals()
  processSupportAuras(tick, units, actions, spatialHash)
  runtimePhases.runGrowthAndCharge()
  runtimePhases.runBurrowRegeneration()
  runtimePhases.runTransformModes()
  runtimePhases.runFieldEffects()
  runtimePhases.runFormationBonuses()
  runtimePhases.runControlBeams()
  runtimePhases.runPeriodicAbilities()
  return triggerContext
}

export function processPostHazardPrimitives(units: SimUnit[], triggerContext: TriggerContext): void {
  const ordered = units.filter(unit => !unit.isDead).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) processHpThresholdTriggers(unit, triggerContext)
}

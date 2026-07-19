import type { BattleAction } from './combat.actions'
import { handleDeath } from './combat.systems.utils'
import { processHpThresholdTriggers, type TriggerContext } from './combat.triggers'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { PRNG } from './combat.utils'

export interface PreActionRuntimePhases {
  runGlobals(): void
  runSupportAuras(): void
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
): TriggerContext {
  const triggerContext = { units, hazards, actions, rng, tick, onUnitDeath: (target: SimUnit, source: SimUnit) => handleDeath(target, source, units, actions, hazards, rng) }
  runtimePhases.runGlobals()
  runtimePhases.runSupportAuras()
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

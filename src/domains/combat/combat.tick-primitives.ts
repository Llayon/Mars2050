import { processHpThresholdTriggers, type TriggerContext } from './combat.triggers'
import type { SimUnit } from './combat.sim.types'

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
  runtimePhases: PreActionRuntimePhases,
): void {
  runtimePhases.runGlobals()
  runtimePhases.runSupportAuras()
  runtimePhases.runGrowthAndCharge()
  runtimePhases.runBurrowRegeneration()
  runtimePhases.runTransformModes()
  runtimePhases.runFieldEffects()
  runtimePhases.runFormationBonuses()
  runtimePhases.runControlBeams()
  runtimePhases.runPeriodicAbilities()
}

export function processPostHazardPrimitives(units: SimUnit[], triggerContext: TriggerContext): void {
  const ordered = units.filter(unit => !unit.isDead).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) processHpThresholdTriggers(unit, triggerContext)
}

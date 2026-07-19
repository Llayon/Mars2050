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

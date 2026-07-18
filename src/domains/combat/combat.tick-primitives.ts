import type { BattleAction } from './combat.actions'
import { processBurrowRegeneration } from './combat.burrow'
import { processSupportAuras } from './combat.auras'
import { processControlBeams } from './combat.control'
import { processFieldEffects } from './combat.field-effects'
import { processFormationBonuses } from './combat.formation'
import { processGlobals } from './combat.globals'
import { processGrowthAndCharge } from './combat.growth-charge'
import { processPeriodicAbilities } from './combat.periodic-abilities'
import { handleDeath } from './combat.systems.utils'
import { processHpThresholdTriggers, type TriggerContext } from './combat.triggers'
import { processTransformModes } from './combat.transform'
import type { GlobalUpgradeConfig } from './combat.upgrades'
import type { SimHazard, SimUnit, Team } from './combat.sim.types'
import type { PRNG } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

export function processPreActionPrimitives(
  tick: number,
  activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[],
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG,
  spatialHash?: SpatialHash,
): TriggerContext {
  const triggerContext = { units, hazards, actions, rng, tick, onUnitDeath: (target: SimUnit, source: SimUnit) => handleDeath(target, source, units, actions, hazards, rng) }
  processGlobals(tick, activeGlobals, units, hazards, actions, rng)
  processSupportAuras(tick, units, actions, spatialHash)
  processGrowthAndCharge(tick, units, actions)
  processBurrowRegeneration(units, actions)
  processTransformModes(tick, units, actions)
  processFieldEffects(tick, units, hazards, actions)
  processFormationBonuses(tick, units, actions)
  processControlBeams(units, actions)
  processPeriodicAbilities(tick, triggerContext)
  return triggerContext
}

export function processPostHazardPrimitives(units: SimUnit[], triggerContext: TriggerContext): void {
  const ordered = units.filter(unit => !unit.isDead).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) processHpThresholdTriggers(unit, triggerContext)
}

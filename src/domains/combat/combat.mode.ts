import type { BattleAction } from './combat.actions'
import type { MobilityMode, SimUnit } from './combat.sim.types'

/**
 * Returns movement speed multiplier from the active mobility mode.
 * @param unit Unit to inspect
 * @returns mode movement multiplier
 */
export function getModeMovementSpeedMultiplier(unit: SimUnit): number {
  const config = unit.modeSwitchConfig
  if (!config) return 1
  if (unit.mobilityMode === 'air') return getPositiveMultiplier(config.airSpeedMultiplier, 1)
  return getPositiveMultiplier(config.groundSpeedMultiplier, 1)
}

/**
 * Toggles aerial mode for movement-triggered mode switch units.
 * @param unit Unit that may switch mobility modes
 * @param shouldMove Whether positioning requires movement this tick
 * @param actions Replay action sink
 */
export function syncModeForMovement(unit: SimUnit, shouldMove: boolean, actions: BattleAction[]): void {
  const config = unit.modeSwitchConfig
  if (!config || config.trigger !== 'while_moving' || unit.isDead) return
  setMobilityMode(unit, shouldMove ? 'air' : 'ground', actions)
}

/**
 * Grounds mode-switching units before active actions when configured.
 * @param unit Unit preparing to attack, heal, or spawn
 * @param actions Replay action sink
 */
export function syncModeForAction(unit: SimUnit, actions: BattleAction[]): void {
  const config = unit.modeSwitchConfig
  if (!config || config.groundForAction === false || unit.isDead) return
  setMobilityMode(unit, 'ground', actions)
}

/**
 * Applies initial runtime mode state to a newly created unit.
 * @param unit Unit to initialize
 */
export function initializeMobilityMode(unit: SimUnit): void {
  const config = unit.modeSwitchConfig
  if (!config) return
  const initialMode = config.startMode ?? 'ground'
  unit.mobilityMode = initialMode
  unit.isFlying = initialMode === 'air'
}

function setMobilityMode(unit: SimUnit, mode: MobilityMode, actions: BattleAction[]): void {
  if (unit.mobilityMode === mode && unit.isFlying === (mode === 'air')) return
  unit.mobilityMode = mode
  unit.isFlying = mode === 'air'
  actions.push({ unitId: unit.id, type: 'mode_change', modeState: mode })
}

function getPositiveMultiplier(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}

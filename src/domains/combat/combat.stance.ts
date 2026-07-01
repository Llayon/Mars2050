import type { BattleAction } from './combat.actions'
import type { SimUnit, StanceMode } from './combat.sim.types'

/**
 * Returns the range multiplier from an active deployed stance.
 * @param unit Unit to inspect
 * @returns range multiplier for currently active stance state
 */
export function getStanceRangeMultiplier(unit: SimUnit): number {
  if (!isDeployed(unit)) return 1
  return getPositiveMultiplier(unit.stanceConfig?.rangeMultiplier, 1)
}

/**
 * Returns the attack range a unit may use while spending ticks to deploy.
 * @param unit Unit to inspect
 * @param currentRange Current effective range without an undeployed stance bonus
 * @returns setup range used to decide whether the unit may deploy instead of moving
 */
export function getStanceSetupActionRange(unit: SimUnit, currentRange: number): number {
  if (!unit.stanceConfig || isDeployed(unit)) return currentRange
  return currentRange * getPositiveMultiplier(unit.stanceConfig.rangeMultiplier, 1)
}

/**
 * Returns movement speed multiplier from the active stance.
 * @param unit Unit to inspect
 * @returns movement multiplier for currently active stance state
 */
export function getStanceMovementSpeedMultiplier(unit: SimUnit): number {
  if (!isDeployed(unit)) return 1
  return Math.max(0, unit.stanceConfig?.speedMultiplier ?? 1)
}

/**
 * Returns action cooldown after stance modifiers.
 * @param unit Unit to inspect
 * @returns cooldown ticks to assign after the next action
 */
export function getStanceActionCooldown(unit: SimUnit): number {
  const multiplier = isDeployed(unit) ? getPositiveMultiplier(unit.stanceConfig?.cooldownMultiplier, 1) : 1
  return Math.max(1, Math.round(unit.actionCooldownMax * multiplier))
}

/**
 * Advances deployment before an attack. A deploying unit consumes its action tick.
 * @param unit Unit preparing to act
 * @param actions Replay action sink
 * @returns true when the unit may attack this tick
 */
export function prepareStanceForAction(unit: SimUnit, actions: BattleAction[]): boolean {
  const config = unit.stanceConfig
  if (!config || isDeployed(unit)) return true

  const required = Math.max(0, Math.floor(config.deployTicks))
  if (required <= 0) {
    setStanceMode(unit, 'deployed', actions)
    return true
  }

  unit.stanceTicks = (unit.stanceTicks ?? 0) + 1
  if (unit.stanceTicks >= required) setStanceMode(unit, 'deployed', actions)
  return false
}

/**
 * Resets deployed stance when movement is required.
 * @param unit Unit that may need to move
 * @param shouldMove Whether positioning decided movement is required
 * @param actions Replay action sink
 */
export function undeployStanceForMovement(unit: SimUnit, shouldMove: boolean, actions: BattleAction[]): void {
  if (!unit.stanceConfig || !shouldMove) return
  unit.stanceTicks = 0
  if (isDeployed(unit)) setStanceMode(unit, 'mobile', actions)
}

function isDeployed(unit: SimUnit): boolean {
  return unit.stanceMode === 'deployed'
}

function setStanceMode(unit: SimUnit, mode: StanceMode, actions: BattleAction[]): void {
  if (unit.stanceMode === mode) return
  unit.stanceMode = mode
  unit.stanceTicks = 0
  actions.push({ unitId: unit.id, type: 'stance_change', stanceMode: mode })
}

function getPositiveMultiplier(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}

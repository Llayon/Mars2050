import { UNIT_TYPES } from '@/domains/combat/combat.config'
import {
  getTier1CommandCost,
  TIER1_COMMAND_RULES,
} from '@/domains/combat/combat.tier1.config'
import type { Obstacle, Team, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import { getDistance, getSizeRadius } from '@/domains/combat/combat.utils'

export type SimulatorMode = 'tier1' | 'qa'

const BASE_SLOT_X = [90, 210, 330, 450, 570] as const
const BASE_SLOT_Y = {
  attacker: [930, 1050, 1170],
  defender: [270, 150, 30],
} as const

export function createSimulatorUnit(
  team: Team,
  type: UnitTypeKey,
  units: UnitRow[],
  mode: SimulatorMode,
  obstacles: Obstacle[] = [],
): UnitRow {
  const config = UNIT_TYPES[type]
  const position = mode === 'tier1' ? getAvailableBaseSlot(team, type, units, obstacles) : getRandomPosition(team)
  return {
    id: crypto.randomUUID(),
    colony_id: team,
    unit_type: type,
    hp_current: config.baseStats.hp,
    tier: 1,
    upgrade_path: [],
    grid_x: String(position.x),
    grid_y: String(position.y),
  }
}

export function getTier1CommandPoints(units: UnitRow[]): number {
  return units.reduce((total, unit) => total + (getTier1CommandCost(unit.unit_type) ?? 0), 0)
}

export function getTier1SetupError(
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  limit: number,
  obstacles: Obstacle[] = [],
): string | null {
  const attackerPoints = getTier1CommandPoints(attackerUnits)
  const defenderPoints = getTier1CommandPoints(defenderUnits)
  if (attackerPoints === 0 || defenderPoints === 0) return 'Добавьте хотя бы по одному отряду каждой стороне.'
  if (attackerPoints > limit || defenderPoints > limit) return `Состав превышает лимит ${limit} ОК.`
  if (attackerPoints !== defenderPoints) return 'Для T1-баланса стороны должны потратить одинаковое число очков.'
  const blockedCount = [...attackerUnits, ...defenderUnits]
    .filter(unit => isTier1DeploymentBlocked(unit, obstacles)).length
  if (blockedCount > 0) return `Расстановка пересекается с препятствием (${blockedCount} отр.). Переместите отряды.`
  return null
}

export function isTier1DeploymentBlocked(unit: UnitRow, obstacles: Obstacle[]): boolean {
  const x = Number(unit.grid_x)
  const y = Number(unit.grid_y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false

  return isDeploymentPointBlocked(unit.unit_type, x, y, obstacles)
}

export function normalizeCommandLimit(value: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : TIER1_COMMAND_RULES.defaultLimit
  return Math.min(TIER1_COMMAND_RULES.maxLimit, Math.max(TIER1_COMMAND_RULES.minLimit, rounded))
}

function getAvailableBaseSlot(
  team: Team,
  type: UnitTypeKey,
  units: UnitRow[],
  obstacles: Obstacle[],
): { x: number; y: number } {
  const occupied = new Set(units.map(unit => `${unit.grid_x}:${unit.grid_y}`))
  for (let index = 0; index < TIER1_COMMAND_RULES.maxLimit; index++) {
    const x = BASE_SLOT_X[index % BASE_SLOT_X.length]
    const y = BASE_SLOT_Y[team][Math.floor(index / BASE_SLOT_X.length)]
    if (!occupied.has(`${x}:${y}`) && !isDeploymentPointBlocked(type, x, y, obstacles)) return { x, y }
  }
  return { x: BASE_SLOT_X[0], y: BASE_SLOT_Y[team][0] }
}

function isDeploymentPointBlocked(type: UnitTypeKey, x: number, y: number, obstacles: Obstacle[]): boolean {
  const deploymentRadius = getDeploymentRadius(type)
  return obstacles.some(obstacle =>
    getDistance(x, y, obstacle.x, obstacle.y) < deploymentRadius + obstacle.radius,
  )
}

function getDeploymentRadius(type: UnitTypeKey): number {
  const config = UNIT_TYPES[type]
  const squadSize = config.squadSize ?? 1
  const unitRadius = getSizeRadius(config.baseStats.size ?? 'M')
  if (squadSize === 1) return unitRadius

  const spacingMultiplier = config.baseStats.formationModifiers?.spacingMultiplier ?? 1
  const spacing = (config.squadSpacing ?? 20) * spacingMultiplier
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const rowCount = Math.ceil(squadSize / rowSize)
  return Math.hypot((rowSize - 1) * spacing / 2, (rowCount - 1) * spacing / 2) + unitRadius
}

function getRandomPosition(team: Team): { x: number; y: number } {
  return {
    x: Math.floor(Math.random() * 600),
    y: Math.floor(Math.random() * 400) + (team === 'attacker' ? 800 : 0),
  }
}

import { UNIT_TYPES } from './combat.config'
import type { UnitRow, UnitTypeKey } from './combat.types'
import { FIELD_HEIGHT, FIELD_WIDTH, getSizeRadius } from './combat.utils'

export type DeploymentMode = 'defense' | 'attack'
export type DeploymentFormation = 'frontline' | 'backline' | 'echelon' | 'split'

export interface DeploymentPoint {
  unitId: string
  x: number
  y: number
}

export interface DeploymentCell {
  x: number
  y: number
}

export const DEPLOYMENT_COLUMNS = 10
export const DEPLOYMENT_ROWS = 20
export const DEPLOYMENT_CELL_W = FIELD_WIDTH / DEPLOYMENT_COLUMNS
export const DEPLOYMENT_CELL_H = FIELD_HEIGHT / DEPLOYMENT_ROWS

export const DEPLOYMENT_ZONES: Record<DeploymentMode, { minY: number, maxY: number }> = {
  defense: { minY: 0, maxY: 480 },
  attack: { minY: 720, maxY: FIELD_HEIGHT },
}

export function pointFromCell(cell: DeploymentCell): { x: number, y: number } {
  return {
    x: Math.round(cell.x * DEPLOYMENT_CELL_W + DEPLOYMENT_CELL_W / 2),
    y: Math.round(cell.y * DEPLOYMENT_CELL_H + DEPLOYMENT_CELL_H / 2),
  }
}

export function cellFromPoint(x: number, y: number): DeploymentCell {
  return {
    x: Math.max(0, Math.min(DEPLOYMENT_COLUMNS - 1, Math.floor(x / DEPLOYMENT_CELL_W))),
    y: Math.max(0, Math.min(DEPLOYMENT_ROWS - 1, Math.floor(y / DEPLOYMENT_CELL_H))),
  }
}

export function isInDeploymentZone(mode: DeploymentMode, x: number, y: number): boolean {
  const zone = DEPLOYMENT_ZONES[mode]
  return x >= 0 && x <= FIELD_WIDTH && y >= zone.minY && y <= zone.maxY
}

export function getDeploymentFootprintRadius(unitType: UnitTypeKey): number {
  const config = UNIT_TYPES[unitType]
  const base = getSizeRadius(config.baseStats.size || 'M')
  const squadSize = config.squadSize || 1
  const spacing = config.squadSpacing || 20
  if (squadSize <= 1) return base + 8
  const rowSize = Math.ceil(Math.sqrt(squadSize))
  const rows = Math.ceil(squadSize / rowSize)
  const spreadX = (rowSize - 1) * spacing * 0.5
  const spreadY = (rows - 1) * spacing * 0.5
  return Math.ceil(base + Math.max(spreadX, spreadY) + 8)
}

export function getDeploymentAttackRadius(unitType: UnitTypeKey): number {
  const config = UNIT_TYPES[unitType]
  return Math.max(0, Math.round(config.baseStats.range * 40))
}

export function findDeploymentOverlap(
  unit: UnitRow,
  point: { x: number, y: number },
  placement: Record<string, { x: number, y: number }>,
  units: UnitRow[]
): UnitRow | null {
  const unitRadius = getDeploymentFootprintRadius(unit.unit_type as UnitTypeKey)
  for (const other of units) {
    if (!other.id || other.id === unit.id) continue
    const otherPoint = placement[other.id]
    if (!otherPoint) continue
    const otherRadius = getDeploymentFootprintRadius(other.unit_type as UnitTypeKey)
    const minDistance = unitRadius + otherRadius + 4
    if (Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y) < minDistance) return other
  }
  return null
}

export function createFormationPlacement(
  units: UnitRow[],
  mode: DeploymentMode,
  formation: DeploymentFormation
): Record<string, { x: number, y: number }> {
  const lanes = getFormationLanes(mode, formation)
  const sorted = [...units].sort((a, b) => getUnitLane(a) - getUnitLane(b))
  const usedByLane = new Map<number, number>()
  const placement: Record<string, { x: number, y: number }> = {}

  for (const unit of sorted) {
    if (!unit.id) continue
    const laneIndex = getUnitLane(unit)
    const laneY = lanes[Math.min(laneIndex, lanes.length - 1)]
    const laneCount = usedByLane.get(laneIndex) || 0
    usedByLane.set(laneIndex, laneCount + 1)
    const col = laneCount % DEPLOYMENT_COLUMNS
    const rowOffset = Math.floor(laneCount / DEPLOYMENT_COLUMNS)
    const x = Math.round((col + 0.5) * DEPLOYMENT_CELL_W)
    const y = clampToZone(mode, laneY + rowOffset * getRowDirection(mode) * DEPLOYMENT_CELL_H)
    placement[unit.id] = { x, y }
  }
  return placement
}

export function serializeDeployment(placement: Record<string, { x: number, y: number }>): DeploymentPoint[] {
  return Object.entries(placement).map(([unitId, point]) => ({
    unitId,
    x: Math.round(point.x),
    y: Math.round(point.y),
  }))
}

function getFormationLanes(mode: DeploymentMode, formation: DeploymentFormation): number[] {
  const zone = DEPLOYMENT_ZONES[mode]
  const front = mode === 'attack' ? zone.minY + 30 : zone.maxY - 30
  const back = mode === 'attack' ? zone.maxY - 90 : zone.minY + 90
  const mid = Math.round((front + back) / 2)
  if (formation === 'backline') return [mid, back, back, front]
  if (formation === 'echelon') return [front, mid, back, mid]
  if (formation === 'split') return [front, back, mid, back]
  return [front, mid, back, back]
}

function getUnitLane(unit: UnitRow): number {
  const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
  if (config.baseStats.speed === 0 || config.baseStats.range <= 1.2) return 0
  if (config.baseStats.attackType === 'heal' || config.baseStats.range >= 6) return 2
  return 1
}

function getRowDirection(mode: DeploymentMode): number {
  return mode === 'attack' ? 1 : -1
}

function clampToZone(mode: DeploymentMode, y: number): number {
  const zone = DEPLOYMENT_ZONES[mode]
  return Math.max(zone.minY + DEPLOYMENT_CELL_H / 2, Math.min(zone.maxY - DEPLOYMENT_CELL_H / 2, y))
}

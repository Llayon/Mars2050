import type { BattleTick, SimUnit, UnitRow } from '@/domains/combat/combat.types'

export interface ReplayRenderUnit {
  unit: SimUnit | UnitRow
  team: 'attacker' | 'defender'
  isSimUnit: boolean
}

export function buildReplayRenderUnits(
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  logs: BattleTick[],
  initialState?: SimUnit[]
): ReplayRenderUnit[] {
  if (initialState && initialState.length > 0) {
    return initialState.map(unit => ({ unit, team: unit.team, isSimUnit: true }))
  }

  const rowsByBaseId = new Map<string, { unit: UnitRow, team: 'attacker' | 'defender' }>()
  attackerUnits.forEach(unit => { if (unit.id) rowsByBaseId.set(unit.id, { unit, team: 'attacker' }) })
  defenderUnits.forEach(unit => { if (unit.id) rowsByBaseId.set(unit.id, { unit, team: 'defender' }) })

  const firstPositions = new Map<string, { x: number, y: number }>()
  const actionIds = new Set<string>()
  const expandedBaseIds = new Set<string>()
  logs.forEach(log => {
    log.actions.forEach(action => {
      actionIds.add(action.unitId)
      if (action.unitId !== getBaseUnitId(action.unitId)) expandedBaseIds.add(getBaseUnitId(action.unitId))
      if (action.targetId) actionIds.add(action.targetId)
      if (action.targetId && action.targetId !== getBaseUnitId(action.targetId)) expandedBaseIds.add(getBaseUnitId(action.targetId))
      if (action.type === 'move' && action.fromX !== undefined && action.fromY !== undefined && !firstPositions.has(action.unitId)) {
        firstPositions.set(action.unitId, { x: action.fromX, y: action.fromY })
      }
    })
  })

  const renderUnits: ReplayRenderUnit[] = []
  const seen = new Set<string>()
  const addRenderUnit = (unitId: string) => {
    if (seen.has(unitId)) return
    const baseId = getBaseUnitId(unitId)
    const row = rowsByBaseId.get(baseId) ?? rowsByBaseId.get(unitId)
    if (!row) return
    const pos = firstPositions.get(unitId)
    renderUnits.push({
      unit: {
        ...row.unit,
        id: unitId,
        grid_x: String(pos?.x ?? row.unit.grid_x ?? 0),
        grid_y: String(pos?.y ?? row.unit.grid_y ?? 0),
      },
      team: row.team,
      isSimUnit: false,
    })
    seen.add(unitId)
  }

  actionIds.forEach(addRenderUnit)
  rowsByBaseId.forEach((_, unitId) => {
    if (!expandedBaseIds.has(unitId)) addRenderUnit(unitId)
  })
  return renderUnits
}

function getBaseUnitId(unitId: string): string {
  return unitId.replace(/_\d+$/, '')
}

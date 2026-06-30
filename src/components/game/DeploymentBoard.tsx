'use client'

import { useState } from 'react'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import {
  DEPLOYMENT_COLUMNS,
  DEPLOYMENT_ROWS,
  cellFromPoint,
  createFormationPlacement,
  findDeploymentOverlap,
  isInDeploymentZone,
  pointFromCell,
  serializeDeployment,
  type DeploymentFormation,
  type DeploymentPoint,
} from '@/domains/combat/combat.deployment'
import { DeploymentBoardField } from './deployment-board-field'

export interface DeploymentPlannerProps {
  units: UnitRow[]
  mode: 'defense' | 'attack'
  onSave: (placement: DeploymentPoint[]) => void
  onCancel?: () => void
  saveLabel?: string
}

export function DeploymentPlanner({ units, mode, onSave, onCancel, saveLabel }: DeploymentPlannerProps) {
  const [placement, setPlacement] = useState<Record<string, { x: number, y: number }>>(() => {
    const initial: Record<string, { x: number, y: number }> = {}
    units.forEach(u => {
      if (!u.id || u.grid_x == null || u.grid_y == null) return
      const point = normalizePoint(Number(u.grid_x), Number(u.grid_y))
      if (isInDeploymentZone(mode, point.x, point.y)) initial[u.id] = point
    })
    return initial
  })
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [showRanges, setShowRanges] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const selectedUnit = selectedUnitId ? units.find(u => u.id === selectedUnitId) : null
  const unplacedUnits = units.filter(u => !u.id || !placement[u.id])
  const overlapErrors = getOverlapErrors(units, placement)
  const canSave = units.length > 0 && unplacedUnits.length === 0 && overlapErrors.length === 0
  const storageKey = `mars2050-deployment-${mode}`

  const handleCellClick = (x: number, y: number) => {
    const point = pointFromCell({ x, y })
    if (!isInDeploymentZone(mode, point.x, point.y)) {
      setMessage('Эта зона недоступна для выбранного режима.')
      return
    }

    const occupantId = findOccupantAtCell(placement, x, y)
    if (occupantId) {
      setSelectedUnitId(occupantId)
      setMessage(null)
      return
    }

    if (!selectedUnitId || !selectedUnit) {
      setMessage('Выберите отряд слева или на поле.')
      return
    }

    const overlap = findDeploymentOverlap(selectedUnit, point, placement, units)
    if (overlap) {
      setMessage(`Нельзя поставить поверх: ${UNIT_TYPES[overlap.unit_type as UnitTypeKey]?.name || overlap.unit_type}.`)
      return
    }

    setPlacement(prev => ({ ...prev, [selectedUnitId]: point }))
    setSelectedUnitId(null)
    setMessage(null)
  }

  const handleRemoveFromGrid = (unitId: string) => {
    setPlacement(prev => {
      const next = { ...prev }
      delete next[unitId]
      return next
    })
    if (selectedUnitId === unitId) setSelectedUnitId(null)
  }

  const handleFormation = (formation: DeploymentFormation) => {
    setPlacement(createFormationPlacement(units, mode, formation))
    setSelectedUnitId(null)
    setMessage('Формация применена. Проверьте радиусы и сохраните.')
  }

  const handleSaveLocal = () => {
    localStorage.setItem(storageKey, JSON.stringify(serializeDeployment(placement)))
    setMessage('Слот формации сохранен локально.')
  }

  const handleLoadLocal = () => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      setMessage('Локальный слот пока пуст.')
      return
    }
    try {
      const ids = new Set(units.map(u => u.id).filter(Boolean))
      const next: Record<string, { x: number, y: number }> = {}
      for (const item of JSON.parse(raw) as DeploymentPoint[]) {
        if (ids.has(item.unitId) && isInDeploymentZone(mode, item.x, item.y)) next[item.unitId] = { x: item.x, y: item.y }
      }
      setPlacement(next)
      setMessage('Локальный слот загружен.')
    } catch {
      setMessage('Локальный слот поврежден. Сохраните формацию заново.')
    }
  }

  return (
    <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] text-white">
      <aside className="border-r border-cyan-400/20 bg-black/45 p-4 overflow-y-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Deployment Phase</div>
          <h2 className="text-xl font-bold mt-1">{mode === 'defense' ? 'Оборона базы' : 'Подготовка к атаке'}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['frontline', 'backline', 'echelon', 'split'] as const).map(key => (
              <button key={key} onClick={() => handleFormation(key)} className="border border-cyan-400/25 bg-cyan-950/30 hover:bg-cyan-900/50 px-2 py-2 text-xs">
                {FORMATION_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={handleSaveLocal} className="flex-1 border border-amber-400/30 bg-amber-950/30 px-2 py-2 text-xs">Слот save</button>
            <button onClick={handleLoadLocal} className="flex-1 border border-amber-400/30 bg-amber-950/30 px-2 py-2 text-xs">Слот load</button>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showRanges} onChange={e => setShowRanges(e.target.checked)} />
            Радиусы и footprint
          </label>

          <div className="mt-4 space-y-2">
            {units.map(unit => {
              const isSelected = selectedUnitId === unit.id
              const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
              return (
                <button
                  key={unit.id}
                  onClick={() => { setSelectedUnitId(isSelected ? null : unit.id!); setMessage(null) }}
                  className={`w-full text-left border px-3 py-2 text-sm ${isSelected ? 'border-cyan-300 bg-cyan-900/40' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold truncate">{config?.name || unit.unit_type}</span>
                    <span className={placement[unit.id!] ? 'text-green-300' : 'text-amber-300'}>{placement[unit.id!] ? 'placed' : 'reserve'}</span>
                  </div>
                  <div className="text-xs text-gray-400">Range {config?.baseStats.range ?? 0} • Squad {config?.squadSize || 1}</div>
                </button>
              )
            })}
          </div>
        </aside>

        <DeploymentBoardField
          mode={mode}
          units={units}
          placement={placement}
          selectedUnitId={selectedUnitId}
          showRanges={showRanges}
          onCellClick={handleCellClick}
          onSelectUnit={setSelectedUnitId}
        />

        <aside className="border-l border-cyan-400/20 bg-black/45 p-4 flex flex-col gap-4">
          <div className="border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Status</div>
            <div className="mt-2 text-sm text-gray-300">Placed: {units.length - unplacedUnits.length}/{units.length}</div>
            <div className="text-sm text-gray-300">Overlap: {overlapErrors.length}</div>
            {selectedUnit && (
              <div className="mt-3 text-sm">
                <div className="font-semibold text-cyan-200">{UNIT_TYPES[selectedUnit.unit_type as UnitTypeKey]?.name}</div>
                <button onClick={() => selectedUnit.id && handleRemoveFromGrid(selectedUnit.id)} className="mt-2 w-full border border-red-400/30 bg-red-950/30 px-2 py-2 text-xs">В резерв</button>
              </div>
            )}
          </div>

          {(message || overlapErrors.length > 0 || unplacedUnits.length > 0) && (
            <div className="border border-amber-400/30 bg-amber-950/25 p-3 text-sm text-amber-100">
              {message || (overlapErrors[0] ?? `Нужно разместить все отряды: ${unplacedUnits.length} в резерве.`)}
            </div>
          )}

          <div className="mt-auto flex gap-2">
            {onCancel && (
              <button onClick={onCancel} className="flex-1 border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2">Отмена</button>
            )}
            <button
              onClick={() => canSave && onSave(serializeDeployment(placement))}
              disabled={!canSave}
              className="flex-1 border border-green-300/40 bg-green-700/70 hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-green-700/70 px-3 py-2"
            >
              {saveLabel || 'Сохранить'}
            </button>
          </div>
        </aside>
    </div>
  )
}

export function DeploymentBoard(props: DeploymentPlannerProps) {
  return (
    <div className="fixed inset-0 bg-[#070b12] z-50 text-white">
      <DeploymentPlanner {...props} />
    </div>
  )
}

function findOccupantAtCell(placement: Record<string, { x: number, y: number }>, x: number, y: number): string | null {
  return Object.keys(placement).find(id => {
    const cell = cellFromPoint(placement[id].x, placement[id].y)
    return cell.x === x && cell.y === y
  }) ?? null
}

function normalizePoint(x: number, y: number): { x: number, y: number } {
  if (x < DEPLOYMENT_COLUMNS && y < DEPLOYMENT_ROWS) return pointFromCell({ x, y })
  return { x: Math.round(x), y: Math.round(y) }
}

function getOverlapErrors(units: UnitRow[], placement: Record<string, { x: number, y: number }>): string[] {
  const errors: string[] = []
  for (const unit of units) {
    if (!unit.id || !placement[unit.id]) continue
    const overlap = findDeploymentOverlap(unit, placement[unit.id], placement, units)
    if (overlap) errors.push(`${UNIT_TYPES[unit.unit_type as UnitTypeKey]?.name} пересекается с ${UNIT_TYPES[overlap.unit_type as UnitTypeKey]?.name}`)
  }
  return [...new Set(errors)]
}

const FORMATION_LABELS: Record<DeploymentFormation, string> = { frontline: 'Фронт', backline: 'Дальний бой', echelon: 'Эшелон', split: 'Фланги' }

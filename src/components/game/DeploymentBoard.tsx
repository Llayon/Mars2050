'use client'

import { useState } from 'react'
import { UNIT_TYPES, GRID_WIDTH, GRID_HEIGHT } from '@/domains/combat/combat.config'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

interface DeploymentBoardProps {
  units: UnitRow[]
  mode: 'defense' | 'attack'
  onSave: (placement: { unitId: string, x: number, y: number }[]) => void
  onCancel: () => void
}

export function DeploymentBoard({ units, mode, onSave, onCancel }: DeploymentBoardProps) {
  // Current placements: unitId -> { x, y }
  const [placement, setPlacement] = useState<Record<string, { x: number, y: number }>>(() => {
    const initial: Record<string, { x: number, y: number }> = {}
    units.forEach(u => {
      if (u.grid_x != null && u.grid_y != null) {
        initial[u.id!] = { x: Number(u.grid_x), y: Number(u.grid_y) }
      }
    })
    return initial
  })

  // Which unit is currently selected to be placed/moved
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  // Allowed Y zones
  const isAllowedZone = (y: number) => {
    if (mode === 'defense') return y >= 0 && y <= 15
    if (mode === 'attack') return y >= 16 && y <= 31
    return false
  }

  const handleCellClick = (x: number, y: number) => {
    if (!isAllowedZone(y)) return // Cannot place outside zone

    // Check if cell is occupied
    const occupantId = Object.keys(placement).find(
      id => placement[id].x === x && placement[id].y === y
    )

    if (occupantId) {
      // If we clicked on a unit, select it
      setSelectedUnitId(occupantId)
      return
    }

    if (selectedUnitId) {
      // Place the selected unit here
      setPlacement(prev => ({
        ...prev,
        [selectedUnitId]: { x, y }
      }))
      setSelectedUnitId(null) // deselect after placement
    }
  }

  const handleRemoveFromGrid = (unitId: string) => {
    setPlacement(prev => {
      const next = { ...prev }
      delete next[unitId]
      return next
    })
    if (selectedUnitId === unitId) setSelectedUnitId(null)
  }

  const handleSave = () => {
    const result = Object.entries(placement).map(([unitId, coords]) => ({
      unitId,
      x: coords.x,
      y: coords.y
    }))
    onSave(result)
  }

  const unplacedUnits = units.filter(u => !placement[u.id!])

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col text-white">
      {/* Header */}
      <div className="p-4 bg-gray-800 flex justify-between items-center shadow-md shrink-0">
        <h2 className="font-bold text-lg">
          {mode === 'defense' ? 'Оборона базы' : 'Подготовка к атаке'}
        </h2>
        <div className="space-x-2">
          <button onClick={onCancel} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
            Отмена
          </button>
          <button onClick={handleSave} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
            Сохранить
          </button>
        </div>
      </div>

      {/* Grid Area - scrollable to handle 10x18 on mobile */}
      <div className="flex-1 overflow-auto p-2 bg-black flex justify-center items-start">
        <div 
          className="grid gap-[1px] bg-gray-700 p-[1px] shrink-0"
          style={{ 
            gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_HEIGHT}, 1fr)`,
            width: 'min(95vw, 400px)',
            // Dynamically calculate height to keep cells square
            height: 'calc(min(95vw, 400px) * (18 / 10))'
          }}
        >
          {Array.from({ length: GRID_HEIGHT }).map((_, y) => (
            Array.from({ length: GRID_WIDTH }).map((_, x) => {
              const allowed = isAllowedZone(y)
              const occupantId = Object.keys(placement).find(
                id => placement[id].x === x && placement[id].y === y
              )
              const occupant = occupantId ? units.find(u => u.id === occupantId) : null
              const isSelected = occupantId && occupantId === selectedUnitId

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => handleCellClick(x, y)}
                  className={`
                    w-full h-full text-[8px] flex items-center justify-center cursor-pointer transition-colors
                    ${allowed ? 'bg-gray-800 hover:bg-gray-600' : 'bg-red-900/20 opacity-50 cursor-not-allowed'}
                    ${isSelected ? 'ring-2 ring-blue-500 z-10' : ''}
                  `}
                >
                  {occupant && (
                    <div 
                      className="w-[80%] h-[80%] rounded-sm shadow flex items-center justify-center font-bold"
                      style={{
                        backgroundColor: occupant.unit_type === 'wall' ? '#4b5563' : 
                                         occupant.unit_type === 'turret' ? '#dc2626' : '#2563eb'
                      }}
                      title={UNIT_TYPES[occupant.unit_type as UnitTypeKey]?.name}
                    >
                      {occupant.unit_type.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              )
            })
          ))}
        </div>
      </div>

      {/* Tray Area - Bottom Bar */}
      <div className="h-40 bg-gray-800 border-t border-gray-700 p-2 flex flex-col shrink-0 relative">
        <div className="text-sm text-gray-400 mb-2">
          Резерв ({unplacedUnits.length}): Выберите юнита, затем кликните по свободной клетке.
        </div>
        <div className="flex-1 overflow-x-auto flex gap-2 pb-2">
          {unplacedUnits.map(unit => {
            const isSelected = selectedUnitId === unit.id
            const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
            return (
              <div
                key={unit.id}
                onClick={() => setSelectedUnitId(isSelected ? null : unit.id!)}
                className={`
                  shrink-0 w-20 h-24 bg-gray-700 rounded border-2 p-1 flex flex-col items-center justify-center cursor-pointer
                  ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-transparent hover:border-gray-500'}
                `}
              >
                <div className="text-xs font-bold text-center leading-tight mb-1">{config?.name}</div>
                <div className="text-[10px] text-gray-400 text-center">
                  HP: {unit.hp_current}
                </div>
              </div>
            )
          })}
          {unplacedUnits.length === 0 && (
            <div className="w-full flex items-center justify-center text-gray-500 text-sm">
              Все юниты размещены на поле
            </div>
          )}
        </div>
        
        {/* Selected Unit Info & Actions */}
        {selectedUnitId && placement[selectedUnitId] && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 px-4 py-2 rounded-full shadow-lg border border-gray-600 flex gap-4 items-center z-50">
            <span className="text-sm">Юнит выбран</span>
            <button 
              onClick={() => handleRemoveFromGrid(selectedUnitId)}
              className="text-red-400 text-sm font-bold hover:text-red-300 bg-gray-800 px-2 py-1 rounded"
            >
              Убрать в резерв
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

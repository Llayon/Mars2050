import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { Team, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import { GlobalUpgradesSelector, UnitSelector } from './simulator.components'

interface SimulatorTeamPanelProps {
  team: Team
  units: UnitRow[]
  globals: string[]
  selectedIndex: number | null
  allowedUnitTypes?: readonly UnitTypeKey[]
  commandPoints?: number
  commandLimit?: number
  onAddUnit: (type: UnitTypeKey) => void
  onSelectUnit: (index: number) => void
  onRemoveUnit: (index: number) => void
  onCoordinateChange: (index: number, axis: 'grid_x' | 'grid_y', value: string) => void
  onToggleGlobal: (id: string) => void
}

export function SimulatorTeamPanel({
  team,
  units,
  globals,
  selectedIndex,
  allowedUnitTypes,
  commandPoints,
  commandLimit,
  onAddUnit,
  onSelectUnit,
  onRemoveUnit,
  onCoordinateChange,
  onToggleGlobal,
}: SimulatorTeamPanelProps) {
  const isAttacker = team === 'attacker'
  const accent = isAttacker ? 'text-blue-400' : 'text-red-400'
  const border = isAttacker ? 'border-blue-900/30' : 'border-red-900/30'
  const selected = isAttacker ? 'bg-blue-900/50 border-blue-500' : 'bg-red-900/50 border-red-500'
  const inputFocus = isAttacker ? 'focus:border-blue-500' : 'focus:border-red-500'
  const isAtLimit = commandPoints !== undefined && commandLimit !== undefined && commandPoints >= commandLimit

  return (
    <section className={`bg-gray-900/50 p-4 rounded-lg border ${border}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className={`text-xl font-bold ${accent}`}>Команда: {isAttacker ? 'Атака (Синие)' : 'Защита (Красные)'}</h2>
        {commandPoints !== undefined && commandLimit !== undefined && (
          <span className="shrink-0 rounded bg-gray-950 px-2 py-1 text-sm text-gray-300">{commandPoints} / {commandLimit} ОК</span>
        )}
      </div>
      <UnitSelector onAddUnit={onAddUnit} allowedUnitTypes={allowedUnitTypes} disabled={isAtLimit} />
      {allowedUnitTypes === undefined && <GlobalUpgradesSelector globals={globals} onToggle={onToggleGlobal} />}
      <div className="mt-4 space-y-1">
        {units.map((unit, index) => (
          <div
            key={unit.id}
            onClick={() => onSelectUnit(index)}
            className={`flex cursor-pointer items-center justify-between rounded border p-2 ${selectedIndex === index ? selected : 'border-transparent bg-gray-800 hover:bg-gray-700'}`}
          >
            <span>{UNIT_TYPES[unit.unit_type]?.name} [{unit.grid_x}, {unit.grid_y}]</span>
            <div className="flex shrink-0 items-center gap-2 text-sm" onClick={event => event.stopPropagation()}>
              <label className="text-gray-400">X:</label>
              <input
                aria-label={`${UNIT_TYPES[unit.unit_type]?.name} X`}
                type="number"
                min="0"
                max="600"
                className={`w-16 rounded border border-gray-600 bg-gray-700 px-1 text-white outline-none ${inputFocus}`}
                value={unit.grid_x ?? ''}
                onChange={event => onCoordinateChange(index, 'grid_x', event.target.value)}
              />
              <label className="text-gray-400">Y:</label>
              <input
                aria-label={`${UNIT_TYPES[unit.unit_type]?.name} Y`}
                type="number"
                min="0"
                max="1200"
                className={`w-16 rounded border border-gray-600 bg-gray-700 px-1 text-white outline-none ${inputFocus}`}
                value={unit.grid_y ?? ''}
                onChange={event => onCoordinateChange(index, 'grid_y', event.target.value)}
              />
            </div>
            <button
              aria-label={`Удалить ${UNIT_TYPES[unit.unit_type]?.name}`}
              onClick={event => { event.stopPropagation(); onRemoveUnit(index) }}
              className="px-2 font-bold text-red-400 hover:text-red-300"
            >×</button>
          </div>
        ))}
      </div>
    </section>
  )
}

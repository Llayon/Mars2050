import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import {
  DEPLOYMENT_COLUMNS,
  DEPLOYMENT_ROWS,
  DEPLOYMENT_ZONES,
  getDeploymentAttackRadius,
  getDeploymentFootprintRadius,
  isInDeploymentZone,
  pointFromCell,
} from '@/domains/combat/combat.deployment'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'

interface DeploymentBoardFieldProps {
  mode: 'defense' | 'attack'
  units: UnitRow[]
  placement: Record<string, { x: number, y: number }>
  selectedUnitId: string | null
  showRanges: boolean
  onCellClick: (x: number, y: number) => void
  onSelectUnit: (unitId: string) => void
}

export function DeploymentBoardField({
  mode,
  units,
  placement,
  selectedUnitId,
  showRanges,
  onCellClick,
  onSelectUnit,
}: DeploymentBoardFieldProps) {
  return (
    <main className="relative flex items-center justify-center overflow-auto p-4 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.08),transparent_55%)]">
      <div className="relative bg-[#111827] border border-cyan-400/30 shadow-[0_0_40px_rgba(0,229,255,0.12)]" style={{ width: 'min(92vw, 520px)', aspectRatio: `${FIELD_WIDTH}/${FIELD_HEIGHT}` }}>
        <div className="absolute inset-x-0 top-0 bg-red-900/25 border-b border-red-400/40" style={{ height: `${(DEPLOYMENT_ZONES.defense.maxY / FIELD_HEIGHT) * 100}%` }} />
        <div className="absolute inset-x-0 bg-yellow-900/10 border-y border-yellow-400/30" style={{ top: `${(DEPLOYMENT_ZONES.defense.maxY / FIELD_HEIGHT) * 100}%`, height: `${((DEPLOYMENT_ZONES.attack.minY - DEPLOYMENT_ZONES.defense.maxY) / FIELD_HEIGHT) * 100}%` }} />
        <div className="absolute inset-x-0 bottom-0 bg-blue-900/25 border-t border-blue-400/40" style={{ height: `${((FIELD_HEIGHT - DEPLOYMENT_ZONES.attack.minY) / FIELD_HEIGHT) * 100}%` }} />
        <div className="absolute left-2 top-[39%] text-[10px] uppercase tracking-widest text-red-200">Defense line</div>
        <div className="absolute left-2 top-[60%] text-[10px] uppercase tracking-widest text-blue-200">Attack line</div>

        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DEPLOYMENT_COLUMNS}, 1fr)`, gridTemplateRows: `repeat(${DEPLOYMENT_ROWS}, 1fr)` }}>
          {Array.from({ length: DEPLOYMENT_ROWS }).map((_, y) =>
            Array.from({ length: DEPLOYMENT_COLUMNS }).map((_, x) => {
              const point = pointFromCell({ x, y })
              const allowed = isInDeploymentZone(mode, point.x, point.y)
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => onCellClick(x, y)}
                  className={`border border-white/[0.06] ${allowed ? 'hover:bg-cyan-300/10' : 'cursor-not-allowed bg-black/25'}`}
                  aria-label={`cell ${x}-${y}`}
                />
              )
            })
          )}
        </div>

        {Object.entries(placement).map(([unitId, point]) => {
          const unit = units.find(u => u.id === unitId)
          if (!unit) return null
          const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
          const footprint = getDeploymentFootprintRadius(unit.unit_type as UnitTypeKey)
          const range = getDeploymentAttackRadius(unit.unit_type as UnitTypeKey)
          const selected = selectedUnitId === unitId
          return (
            <div key={unitId} className="absolute pointer-events-none" style={{ left: `${(point.x / FIELD_WIDTH) * 100}%`, top: `${(point.y / FIELD_HEIGHT) * 100}%` }}>
              {showRanges && selected && range > 0 && <RangeCircle radius={range} color="border-amber-300/40" />}
              {showRanges && <RangeCircle radius={footprint} color={selected ? 'border-cyan-200/70' : 'border-white/20'} />}
              <button
                onClick={() => onSelectUnit(unitId)}
                className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 border text-[10px] font-bold ${selected ? 'bg-cyan-300 text-black border-white' : mode === 'attack' ? 'bg-blue-500 border-blue-200' : 'bg-red-500 border-red-200'}`}
                title={config?.name}
              >
                {(config?.name || unit.unit_type).slice(0, 1)}
              </button>
            </div>
          )
        })}
      </div>
    </main>
  )
}

function RangeCircle({ radius, color }: { radius: number, color: string }) {
  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${color}`}
      style={{
        width: `${(radius * 2 / FIELD_WIDTH) * 100}%`,
        height: `${(radius * 2 / FIELD_HEIGHT) * 100}%`,
      }}
    />
  )
}

import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'

interface PlacementActionBarProps {
  placementMode: BuildingTypeKey
  resources: ResourceRow[]
  onCancel: () => void
}

export function PlacementActionBar({ placementMode, resources, onCancel }: PlacementActionBarProps) {
  const config = BUILDING_TYPES[placementMode]
  if (!config) return null

  return (
    <div className="absolute bottom-6 md:bottom-12 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-2 flex items-center gap-3 pointer-events-auto animate-slide-up shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-w-full">
        
        {/* Icon & Name */}
        <div className="flex items-center gap-2 bg-black/50 rounded-xl p-2 pr-4">
          <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Строительство</div>
            <div className="text-sm font-bold text-white leading-none mt-0.5">{config.name}</div>
          </div>
        </div>

        {/* Cost */}
        <div className="hidden sm:flex items-center gap-3 px-2">
          {Object.entries(config.cost).map(([resType, amount]) => {
            const res = resources.find(r => r.type === resType)
            const hasEnough = res && res.amount >= amount
            return (
              <div key={resType} className="flex flex-col items-center">
                <span className={`text-sm font-mono font-bold ${hasEnough ? 'text-gray-200' : 'text-red-400'}`}>
                  {amount}
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-wide">
                  {RESOURCE_NAMES[resType] || resType}
                </span>
              </div>
            )
          })}
        </div>

        {/* Hint (Mobile only) */}
        <div className="sm:hidden text-[10px] text-gray-400 font-medium px-2 leading-tight flex-1 text-center">
          Тапните по карте<br/>для постройки
        </div>

        {/* Action */}
        <button 
          onClick={onCancel} 
          className="ml-auto bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl text-xs font-bold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center gap-2"
        >
          <span>ОТМЕНА</span>
          <span className="text-lg leading-none">&times;</span>
        </button>
      </div>
    </div>
  )
}

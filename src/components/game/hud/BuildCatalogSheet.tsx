import { useState } from 'react'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'

interface BuildCatalogSheetProps {
  resources: ResourceRow[]
  isMobile?: boolean
  onBuild: (type: BuildingTypeKey) => void
  onClose: () => void
}

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'energy', label: 'Энергия' },
  { id: 'extraction', label: 'Добыча' },
  { id: 'life', label: 'Жизнь' },
  { id: 'industry', label: 'Пром' },
  { id: 'research', label: 'Наука' },
  { id: 'housing', label: 'Жилье' },
  { id: 'military', label: 'Армия' }
] as const

type CategoryId = typeof CATEGORIES[number]['id']

// Quick heuristic mapping
function getCategory(type: BuildingTypeKey): CategoryId {
  if (['solar_panels', 'geothermal_plant'].includes(type)) return 'energy'
  if (['mine', 'advanced_mine', 'water_extractor'].includes(type)) return 'extraction'
  if (['oxygen_generator', 'greenhouse'].includes(type)) return 'life'
  if (['workshop', 'vehicle_bay', 'nanoforge'].includes(type)) return 'industry'
  if (['research_lab', 'biotech_lab', 'data_center', 'university'].includes(type)) return 'research'
  if (['habitat', 'habitat_mk2', 'habitat_mk3', 'community_hall', 'executive_dome'].includes(type)) return 'housing'
  if (['military_academy', 'hq', 'spaceport'].includes(type)) return 'military'
  return 'all'
}

export function BuildCatalogSheet({ resources, isMobile, onBuild, onClose }: BuildCatalogSheetProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [previewBuilding, setPreviewBuilding] = useState<BuildingTypeKey | null>(null)

  const handleInteraction = (type: BuildingTypeKey) => {
    if (isMobile) {
      if (previewBuilding === type) {
        onBuild(type)
        onClose()
      } else {
        setPreviewBuilding(type)
      }
    } else {
      onBuild(type)
      onClose()
    }
  }

  const filteredBuildings = Object.entries(BUILDING_TYPES).filter(([type]) => {
    if (activeCategory === 'all') return true
    return getCategory(type as BuildingTypeKey) === activeCategory
  }) as [BuildingTypeKey, typeof BUILDING_TYPES[BuildingTypeKey]][]

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-30 pointer-events-auto" onClick={onClose} />

      {/* Compact Floating Sheet anchored above CommandDock */}
      <div className="absolute bottom-[70px] left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 backdrop-blur-xl border border-gray-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-slide-up pointer-events-auto flex flex-col w-max max-w-[95vw]">
        
        {/* Hover Tooltip (appears above the sheet when hovering a building) */}
        {previewBuilding && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-black/95 border border-cyan-500/50 rounded shadow-xl w-64 pointer-events-none animate-fade-in z-50">
            <h3 className="text-cyan-300 font-bold text-sm mb-1">{BUILDING_TYPES[previewBuilding].name}</h3>
            <p className="text-[10px] text-gray-400 mb-2 leading-tight">{BUILDING_TYPES[previewBuilding].description}</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div><span className="text-gray-500">Размер: </span><span className="text-gray-200">{BUILDING_TYPES[previewBuilding].width}x{BUILDING_TYPES[previewBuilding].height}</span></div>
              <div><span className="text-gray-500">Рабочие: </span><span className="text-gray-200">{BUILDING_TYPES[previewBuilding].workforce.count}</span></div>
            </div>
            
            {(Object.keys(BUILDING_TYPES[previewBuilding].production).length > 0 || Object.keys(BUILDING_TYPES[previewBuilding].consumption).length > 0) && (
              <div className="mt-2 pt-2 border-t border-gray-800 space-y-0.5 text-[10px]">
                {Object.entries(BUILDING_TYPES[previewBuilding].production).map(([res, amt]) => (
                  <div key={res} className="flex justify-between text-green-400"><span>+ {RESOURCE_NAMES[res] || res}</span><span>{amt}/ч</span></div>
                ))}
                {Object.entries(BUILDING_TYPES[previewBuilding].consumption).map(([res, amt]) => (
                  <div key={res} className="flex justify-between text-red-400"><span>- {RESOURCE_NAMES[res] || res}</span><span>{amt}/ч</span></div>
                ))}
              </div>
            )}
            {isMobile && (
              <div className="mt-3 text-center">
                <span className="text-[10px] text-cyan-300 font-bold animate-pulse uppercase">Тапните еще раз для постройки</span>
              </div>
            )}
          </div>
        )}

        {/* Categories Bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800 overflow-x-auto scrollbar-none justify-center">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${activeCategory === cat.id ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/50' : 'text-gray-400 hover:text-cyan-200 hover:bg-gray-800/80 border border-transparent'}`}
            >
              {cat.label}
            </button>
          ))}
          <button onClick={onClose} className="ml-2 text-gray-500 hover:text-white px-2 text-lg leading-none">&times;</button>
        </div>

        {/* Buildings Carousel */}
        <div className="flex gap-2 p-2 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent max-w-[800px]">
          {filteredBuildings.map(([type, config]) => {
            const canAfford = Object.entries(config.cost).every(([k, v]) => {
              const res = resources.find(r => r.type === k)
              return res && res.amount >= v
            })

            return (
              <div 
                key={type}
                onClick={() => handleInteraction(type)}
                onMouseEnter={() => !isMobile && setPreviewBuilding(type)}
                onMouseLeave={() => !isMobile && setPreviewBuilding(null)}
                className={`flex-none w-20 flex flex-col rounded-lg border transition-all cursor-pointer group ${canAfford ? 'border-gray-700 bg-gray-800/60 hover:border-cyan-500 hover:bg-cyan-900/40 hover:-translate-y-0.5' : 'border-gray-800 bg-black/60 opacity-60 cursor-not-allowed'} ${isMobile && previewBuilding === type ? 'border-cyan-500 bg-cyan-900/40 -translate-y-1' : ''}`}
              >
                <div className="flex-1 aspect-square flex items-center justify-center p-2 relative">
                  <div className="w-full h-full bg-black/40 rounded flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🏢
                  </div>
                  {/* Cost preview small icons overlay */}
                  <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                     {Object.entries(config.cost).slice(0, 1).map(([resType, amount]) => {
                        const res = resources.find(r => r.type === resType)
                        const hasEnough = res && res.amount >= amount
                        return (
                           <span key={resType} className={`text-[8px] px-1 rounded bg-black/80 font-mono ${hasEnough ? 'text-gray-300' : 'text-red-400'}`}>
                             {amount}
                           </span>
                        )
                     })}
                  </div>
                </div>
                <div className="text-center pb-1.5 px-1">
                  <div className="text-[9px] font-bold text-gray-200 leading-tight line-clamp-2 h-[22px] flex items-center justify-center">{config.name}</div>
                </div>
              </div>
            )
          })}
          {filteredBuildings.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic p-4 min-w-[200px]">
              Нет доступных зданий в этой категории
            </div>
          )}
        </div>
      </div>
    </>
  )
}

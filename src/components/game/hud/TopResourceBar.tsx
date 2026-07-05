import type { ResourceRow, ResourceTypeKey } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import type { PopulationState } from '@/domains/population/population.types'
import type { Colony } from '@/domains/colony/colony.types'

interface TopResourceBarProps {
  resources: ResourceRow[]
  population: PopulationState | null
  colony: Colony | null
  isMobile?: boolean
}

export function TopResourceBar({ resources, population, colony, isMobile }: TopResourceBarProps) {
  // Sort resources in a standard order for UI (using actual keys)
  const orderedKeys: ResourceTypeKey[] = [
    'energy',
    'minerals',
    'water',
    'oxygen',
    'food',
    'research_points',
    'consumer_goods',
    'rare_metals',
    'databanks',
    'nanomaterials'
  ]
  const displayResources = orderedKeys.map(key => {
    const res = resources.find(r => r.type === key)
    return res || { type: key, amount: 0, capacity: 0, production_rate: 0, consumption_rate: 0 }
  })

  // Calculations for population
  const workers = population?.workers || 0
  const technicians = population?.technicians || 0
  const scientists = population?.scientists || 0
  const directors = population?.directors || 0
  const totalPop = workers + technicians + scientists + directors
  
  // Safe fallback for housing since we don't have a reliable building calc here yet
  const housingCapacity = '—'

  // Weighted happiness
  let weightedHappiness = 100
  if (totalPop > 0 && population) {
    weightedHappiness = Math.round(
      ((population.happiness_workers || 0) * workers +
      (population.happiness_technicians || 0) * technicians +
      (population.happiness_scientists || 0) * scientists +
      (population.happiness_directors || 0) * directors) / totalPop
    )
  }

  // Warning states
  const hasWorkerWarning = workers === 0
  const lowHappiness = weightedHappiness < 50

  if (isMobile) {
    // Mobile: ultra compact
    return (
      <div data-testid="top-resource-bar" className="absolute top-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 p-2 flex flex-col gap-1 pointer-events-auto shadow-[0_0_15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1 font-bold flex-shrink-0">
            <span className="text-cyan-400 bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/50">
              Lv. {colony?.level || 1}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none no-scrollbar text-[10px] flex-1 min-w-0 ml-2 pr-1 select-none">
            {displayResources.map(res => {
              const delta = res.production_rate - res.consumption_rate
              const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
              const roundedDelta = Math.round(delta)
              const isNearCap = res.capacity > 0 && res.amount >= res.capacity * 0.95
              return (
                <div key={res.type} className={`flex items-center gap-1 flex-shrink-0 bg-gray-800/40 px-2 py-0.5 rounded border ${isNearCap ? 'border-orange-400/60' : 'border-gray-700/30'}`}>
                  <span className="text-cyan-400"><ResourceIcon type={res.type} className="w-3.5 h-3.5" /></span>
                  <span className="font-bold text-white">{Math.floor(res.amount)}</span>
                  <span className={`${deltaColor} font-mono text-[9px] font-semibold`}>
                    {roundedDelta > 0 ? '+' : ''}{roundedDelta}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex justify-around items-center text-[10px] bg-slate-900/50 rounded py-0.5 border border-slate-700/50">
          <span className={`flex items-center gap-1 ${hasWorkerWarning ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>WRK: {workers}</span>
          </span>
          <span className="flex items-center gap-1 text-gray-300">
            <span className="w-2 h-2 rounded-full bg-amber-400/50"></span>
            <span>HAB: {totalPop}/{housingCapacity}</span>
          </span>
          <span className={`flex items-center gap-1 ${lowHappiness ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
            <span className="w-2 h-2 rounded-full bg-green-400/50"></span>
            <span>HAP: {weightedHappiness}%</span>
          </span>
        </div>
      </div>
    )
  }

  // Desktop: Ultra minimal single-tier HUD (Anno style)
  return (
    <div data-testid="top-resource-bar" className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-2 pb-8 px-6 flex justify-between items-start pointer-events-none">
      
      {/* Left: Colony Info */}
      <div className="flex flex-col pointer-events-auto">
        <div className="text-xl font-serif text-white tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {colony?.name || 'Base: Alpha'}
        </div>
        <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          Уровень {colony?.level || 1}
        </div>
      </div>
      
      {/* Center: Global Resources & Population */}
      <div className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-1.5 pointer-events-auto shadow-2xl">
        
        {/* Population Compact */}
        <div className="flex gap-4 items-center mr-6">
           <div className="flex items-center gap-2 text-xs font-bold text-gray-200" title={`Рабочие: ${workers} | Инженеры: ${technicians} | Ученые: ${scientists}`}>
             <span className="opacity-80 text-cyan-200"><ResourceIcon type="population" className="w-4 h-4" /></span> 
             <span>{totalPop} <span className="text-gray-500 font-normal">/ {housingCapacity}</span></span>
           </div>
           <div className={`flex items-center gap-1.5 text-xs font-bold ${lowHappiness ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
             <span className="opacity-80 text-green-300"><ResourceIcon type="happiness" className="w-4 h-4" /></span> 
             <span>{weightedHappiness}%</span>
           </div>
        </div>

        <div className="w-px h-5 bg-white/10 mr-6"></div>

        {/* Resources */}
        <div className="flex gap-6 items-center">
          {displayResources.map(res => {
            const delta = res.production_rate - res.consumption_rate
            const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'
            const roundedDelta = Math.round(delta)
            const title = `${RESOURCE_NAMES[res.type] || res.type}: ${Math.floor(res.amount).toLocaleString('ru-RU')}/${Math.floor(res.capacity).toLocaleString('ru-RU')}`
            return (
              <div key={res.type} className="flex items-center gap-2 group cursor-default" title={title}>
                <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] opacity-80 group-hover:opacity-100 transition-opacity">
                  <ResourceIcon type={res.type} className="w-5 h-5" />
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white font-bold text-sm drop-shadow-md">{Math.floor(res.amount)}</span>
                  <span className={`text-[10px] font-mono ${deltaColor}`}>
                    {roundedDelta > 0 ? '+' : ''}{roundedDelta}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Placeholder for symmetry */}
      <div className="w-32"></div>
    </div>
  )
}

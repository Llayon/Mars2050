import type { ResourceRow, ResourceTypeKey } from '@/domains/resource/resource.types'
import { RESOURCE_ICONS, RESOURCE_NAMES } from '@/domains/resource/resource.types'
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
  const orderedKeys: ResourceTypeKey[] = ['energy', 'minerals', 'water', 'oxygen', 'food', 'research_points']
  const displayResources = orderedKeys.map(key => {
    const res = resources.find(r => r.type === key)
    return res || { type: key, amount: 0, production_rate: 0, consumption_rate: 0 }
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
      <div className="absolute top-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 p-2 flex flex-col gap-1 pointer-events-auto shadow-[0_0_15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1 font-bold">
            <span className="text-cyan-400 bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/50">
              Lv. {colony?.level || 1}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto custom-scrollbar no-scrollbar text-[10px]">
            {displayResources.slice(0, 4).map(res => {
              const delta = res.production_rate - res.consumption_rate
              const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
              return (
                <div key={res.type} className="flex items-center gap-1">
                  <span className="text-gray-300">{RESOURCE_ICONS[res.type] || '📦'}</span>
                  <span className="font-bold text-white">{Math.floor(res.amount)}</span>
                  <span className={`${deltaColor}`}>
                    {delta > 0 ? '+' : ''}{delta}/h
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

  // Desktop: Two-tier HUD
  return (
    <div className="absolute top-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-md border-b border-cyan-500/30 p-2 flex flex-col gap-2 pointer-events-auto shadow-[0_0_20px_rgba(0,0,0,0.8)]">
      {/* Tier 1: Resources */}
      <div className="flex justify-between items-center text-sm px-4">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-900/40 border border-cyan-500/50 text-cyan-300 font-bold px-3 py-1 rounded flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <span className="text-lg">⬡</span>
            <span className="tracking-wider uppercase">{colony?.name || 'Base: Alpha'}</span>
            <span className="text-cyan-100/50">|</span>
            <span className="text-xs">Lv. {colony?.level || 1}</span>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          {displayResources.map(res => {
            const delta = res.production_rate - res.consumption_rate
            const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'
            const name = RESOURCE_NAMES[res.type] || res.type
            return (
              <div key={res.type} className="flex flex-col items-center min-w-[70px]">
                <div className="flex items-center gap-1.5 text-gray-300 text-xs font-bold uppercase tracking-wide">
                  <span>{RESOURCE_ICONS[res.type] || '📦'}</span>
                  {name.substring(0, 8)}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white font-bold">{Math.floor(res.amount)}</span>
                  <span className={`text-[10px] ${deltaColor}`}>
                    {delta > 0 ? '+' : ''}{delta}/h
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tier 2: Population & Economy */}
      <div className="flex justify-center px-4">
        <div className="flex gap-8 items-center bg-slate-900/60 border border-slate-700/50 rounded-full px-8 py-1.5 text-xs shadow-inner">
          <div className={`flex items-center gap-2 ${hasWorkerWarning ? 'text-red-400 animate-pulse font-bold' : 'text-cyan-100'}`}>
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]"></span>
            <span className="uppercase tracking-wider">Workers: {workers}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-2 text-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></span>
            <span className="uppercase tracking-wider">Techs: {technicians}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-2 text-purple-200">
            <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.8)]"></span>
            <span className="uppercase tracking-wider">Sci: {scientists}</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className={`flex items-center gap-2 ${lowHappiness ? 'text-red-400 animate-pulse font-bold' : 'text-green-300'}`}>
            <span className="w-2 h-2 bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)] rotate-45"></span>
            <span className="uppercase tracking-wider">Happiness: {weightedHappiness}%</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-2 text-amber-200">
            <span className="w-2 h-2 bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] rotate-45"></span>
            <span className="uppercase tracking-wider">Housing: {totalPop}/{housingCapacity}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

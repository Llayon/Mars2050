import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import { BUILDING_TYPES } from '@/domains/building/building.config'

import { useToast } from '@/components/ui/toast'

interface EconomyTabProps {
  resources: ResourceRow[]
  population: PopulationState | null
  buildings: BuildingRow[]
  onUpgradePopulation: (fromTier: PopulationTier, count: number) => Promise<void>
}

const TIERS: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']

export function EconomyTab({ resources, population, buildings, onUpgradePopulation }: EconomyTabProps) {
  const { toast } = useToast()
  const warnings: string[] = []

  // Calculate totals
  let totalPopulation = 0
  let totalHousing = 0
  const tierStats: Record<PopulationTier, { count: number, housing: number, employed: number }> = {
    worker: { count: 0, housing: 0, employed: 0 },
    technician: { count: 0, housing: 0, employed: 0 },
    scientist: { count: 0, housing: 0, employed: 0 },
    director: { count: 0, housing: 0, employed: 0 }
  }

  if (population) {
    TIERS.forEach(tier => {
      const count = (population[`${tier}s` as keyof PopulationState] as number) || 0
      totalPopulation += count
      tierStats[tier].count = count
    })
  }

  buildings.forEach(b => {
    if (!b.is_active) return
    const typeConfig = BUILDING_TYPES[b.type as keyof typeof BUILDING_TYPES]
    if (!typeConfig) return

    // Calculate housing
    TIERS.forEach(tier => {
      const capacity = POPULATION_TIERS[tier].housingPerBuilding[b.type] || 0
      tierStats[tier].housing += capacity
      totalHousing += capacity
    })

    // Calculate employment
    if (typeConfig.workforce && typeConfig.workforce.count > 0) {
      const wTier = typeConfig.workforce.tier as PopulationTier
      if (tierStats[wTier]) tierStats[wTier].employed += typeConfig.workforce.count
    }
  })

  if (population) {
    if (totalHousing - totalPopulation < 5) warnings.push('Низкая вместимость жилья')
    if (tierStats.worker.count > tierStats.worker.employed) {
      const idle = tierStats.worker.count - tierStats.worker.employed
      warnings.push(`Безработные: ${idle} (Workers)`)
    }
  }

  const lowResources = resources.filter(r => r.amount < 100 && r.consumption_rate > r.production_rate)
  lowResources.forEach(r => warnings.push(`Дефицит: ${RESOURCE_NAMES[r.type] || r.type}`))

  return (
    <div className="absolute inset-0 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-black flex gap-6">
      
      {/* Left Column: Flow */}
      <div className="flex-1 space-y-6">
        <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-4">Production Chains</h2>
        <div className="space-y-4">
          {resources.map(r => {
            const net = r.production_rate - r.consumption_rate
            const netColor = net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-500'
            const netSign = net > 0 ? '+' : ''
            
            // Calculate breakdown
            const producers: Record<string, number> = {}
            const consumers: Record<string, number> = {}
            
            buildings.forEach(b => {
              if (!b.is_active) return
              const typeConfig = BUILDING_TYPES[b.type as keyof typeof BUILDING_TYPES]
              if (!typeConfig) return
              
              const prod = typeConfig.production?.[r.type as keyof typeof typeConfig.production] || 0
              if (prod > 0) {
                producers[b.type] = (producers[b.type] || 0) + prod
              }
              const cons = typeConfig.consumption?.[r.type as keyof typeof typeConfig.consumption] || 0
              if (cons > 0) {
                consumers[b.type] = (consumers[b.type] || 0) + cons
              }
            })
            
            return (
              <div key={r.type} className="bg-gray-800/40 border border-gray-700 p-4 rounded flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-gray-700/50 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 drop-shadow-md"><ResourceIcon type={r.type} className="w-6 h-6" /></span>
                    <div>
                      <div className="font-bold text-white">{RESOURCE_NAMES[r.type] || r.type}</div>
                      <div className="text-xs text-gray-400">Stock: {Math.floor(r.amount).toLocaleString('ru-RU')}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4 text-sm">
                    <div className="text-gray-400">
                      <span className="text-green-400">+{Math.round(r.production_rate)}/h</span> | 
                      <span className="text-red-400"> -{Math.round(r.consumption_rate)}/h</span>
                    </div>
                    <div className={`font-mono font-bold w-16 text-right ${netColor}`}>
                      {netSign}{Math.round(net)}
                    </div>
                  </div>
                </div>
                
                {/* Breakdown details */}
                <div className="flex gap-4 text-xs pt-1">
                  <div className="flex-1 space-y-1">
                    <div className="text-gray-500 uppercase tracking-wider mb-1">Sources (Buildings)</div>
                    {Object.entries(producers).length > 0 ? (
                      Object.entries(producers).map(([type, amount]) => (
                        <div key={type} className="flex justify-between text-green-300/80">
                          <span>{BUILDING_TYPES[type as keyof typeof BUILDING_TYPES]?.name || type}</span>
                          <span>+{amount}/h</span>
                        </div>
                      ))
                    ) : <div className="text-gray-600">-</div>}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-gray-500 uppercase tracking-wider mb-1">Consumers (Buildings)</div>
                    {Object.entries(consumers).length > 0 ? (
                      Object.entries(consumers).map(([type, amount]) => (
                        <div key={type} className="flex justify-between text-red-300/80">
                          <span>{BUILDING_TYPES[type as keyof typeof BUILDING_TYPES]?.name || type}</span>
                          <span>-{amount}/h</span>
                        </div>
                      ))
                    ) : <div className="text-gray-600">-</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Column: Summaries & Warnings */}
      <div className="w-80 flex-none space-y-6">
        {/* Population Info */}
        <div className="bg-cyan-900/10 border border-cyan-900/50 p-4 rounded">
          <h2 className="text-xs font-bold text-cyan-500 tracking-widest uppercase mb-4">Workforce</h2>
          {population ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Population</span>
                <span className="text-white font-mono">{totalPopulation} / {totalHousing}</span>
              </div>
              <div className="space-y-1">
                {TIERS.map((tier, index) => {
                  const stats = tierStats[tier]
                  const nextTier = TIERS[index + 1]
                  const hasUpgrade = nextTier && POPULATION_TIERS[tier].upgradeBuilding
                  
                  return (
                    <div key={tier} className="flex justify-between items-center text-xs border-t border-cyan-900/30 pt-1">
                      <span className="text-gray-500 capitalize">{tier}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-300">{stats.employed}/{stats.count}</span>
                        {hasUpgrade && stats.count > 0 && (
                          <button 
                            onClick={async () => {
                              try {
                                await onUpgradePopulation(tier as 'worker'|'technician'|'scientist', 1)
                                toast(`Успешно обучен 1 ${nextTier}`, 'success')
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Ошибка обучения', 'error')
                              }
                            }}
                            className="bg-cyan-900/50 hover:bg-cyan-700 text-cyan-300 border border-cyan-700 rounded px-1 text-[10px]"
                            title={`Upgrade to ${nextTier}`}
                          >
                            UPG
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-xs">No census data available</div>
          )}
        </div>

        {/* Buildings Summary */}
        <div className="bg-gray-800/40 border border-gray-700 p-4 rounded">
          <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">Infrastructure</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Active Buildings</span>
            <span className="text-white font-mono">{buildings.filter(b => b.is_active).length} / {buildings.length}</span>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-red-900/10 border border-red-900/50 p-4 rounded">
            <h2 className="text-xs font-bold text-red-500 tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="animate-pulse">⚠️</span> Alerts
            </h2>
            <ul className="space-y-2 text-sm text-red-300/90 list-disc pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

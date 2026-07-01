'use client'

import { memo } from 'react'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import type { BuildingRow } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { sumJobsForTier, getEffectiveProduction } from '@/domains/building/building.production'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'

interface PopulationScreenProps {
  population: PopulationState | null
  buildings: BuildingRow[]
  resources: ResourceRow[]
  onUpgrade: (fromTier: PopulationTier, count: number) => Promise<void>
}

export const PopulationScreen = memo(function PopulationScreen({
  population,
  buildings,
  resources,
  onUpgrade,
}: PopulationScreenProps) {
  if (!population) {
    return (
      <div className="flex flex-col h-full bg-mars-bg pt-safe pb-[80px]">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Данные о населении загружаются...
        </div>
      </div>
    )
  }

  const tiers: PopulationTier[] = ['worker', 'technician', 'scientist', 'director']

  // To calculate total housing capacity per tier
  const housingPerTier: Record<PopulationTier, number> = { worker: 0, technician: 0, scientist: 0, director: 0 }
  for (const b of buildings) {
    if (!b.is_active) continue
    for (const t of tiers) {
      const cap = POPULATION_TIERS[t].housingPerBuilding[b.type] || 0
      housingPerTier[t] += cap
    }
  }

  return (
    <div className="flex flex-col h-full bg-mars-bg pt-safe pb-[80px] overflow-y-auto custom-scrollbar">
      <div className="px-4 py-6 border-b border-mars-border sticky top-0 bg-mars-bg/95 backdrop-blur z-10">
        <h1 className="text-2xl font-bold text-white tracking-wide">НАСЕЛЕНИЕ КОЛОНИИ</h1>
        <p className="text-sm text-gray-400 mt-1">Управление персоналом и потребностями</p>
      </div>

      <div className="p-4 space-y-6">
        {tiers.map((tierKey, idx) => {
          const config = POPULATION_TIERS[tierKey]
          const count = population[`${tierKey}s` as keyof PopulationState] as number
          const happiness = population[`happiness_${tierKey}s` as keyof PopulationState] as number
          const housing = housingPerTier[tierKey]
          
          if (count === 0 && tierKey !== 'worker') {
            return (
              <div key={tierKey} className="hud-panel p-4 opacity-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500"><ResourceIcon type={tierKey} className="w-8 h-8" /></span>
                  <div>
                    <h3 className="font-bold text-gray-400">{config.name}</h3>
                    <p className="text-xs text-gray-500">
                      {config.upgradeBuilding ? `Постройте ${config.upgradeBuilding} для разблокировки` : 'Недоступно'}
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          const jobsTotal = sumJobsForTier(tierKey, buildings)
          
          return (
            <div key={tierKey} className="hud-panel p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <ResourceIcon type={tierKey} className="w-16 h-16 text-white" />
              </div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex gap-4 items-center">
                  <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-cyan-400">
                    <ResourceIcon type={tierKey} className="w-10 h-10 drop-shadow-md" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {config.name}
                      <span className="text-sm font-normal text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">
                        {count} чел.
                      </span>
                    </h2>
                    <div className="flex gap-3 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <ResourceIcon type="happiness" className="w-4 h-4" /> {happiness}%
                      </span>
                      <span className={`flex items-center gap-1 ${count > housing ? 'text-red-400' : 'text-gray-300'}`}>
                        <ResourceIcon type="housing" className="w-4 h-4" /> {count} / {housing}
                      </span>
                    </div>
                  </div>
                </div>
                
                {idx < tiers.length - 1 && count >= 10 && (
                  <button 
                    onClick={() => onUpgrade(tierKey, 10)}
                    disabled={count < 10}
                    className="px-4 py-2 bg-mars-orange/20 text-orange-400 border border-mars-orange hover:bg-mars-orange hover:text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    Апгрейд (10) →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 relative z-10">
                {/* Needs Box */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Потребности</h3>
                  <div className="space-y-3">
                    {config.needs.map(need => {
                      const res = resources.find(r => r.type === need.resource)
                      const available = res ? res.amount : 0
                      const required = need.amountPer10 * (count / 10)
                      const isSatisfied = available >= required
                      const ratio = required > 0 ? Math.min(100, Math.round((available / required) * 100)) : 100
                      
                      return (
                        <div key={need.resource} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center gap-1 text-gray-300">
                              <span className="text-cyan-400"><ResourceIcon type={need.resource} className="w-3.5 h-3.5" /></span> {need.resource}
                              <span className="text-[10px] text-gray-500 ml-1">
                                ({need.category})
                              </span>
                            </span>
                            <span className={ratio < 100 ? 'text-red-400' : 'text-green-400'}>
                              {ratio}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${ratio < 100 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Jobs Box */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider flex justify-between">
                    <span>Рабочие места</span>
                    <span className={count < jobsTotal ? 'text-red-400' : 'text-green-400'}>
                      {count} / {jobsTotal}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {buildings
                      .filter(b => b.is_active)
                      .reduce((acc, b) => {
                        const bConf = POPULATION_TIERS[tierKey].workforceFor.includes(b.type)
                        if (bConf) {
                          acc[b.type] = (acc[b.type] || 0) + 1
                        }
                        return acc
                      }, {} as Record<string, number>) && 
                      Object.entries(buildings
                        .filter(b => b.is_active)
                        .reduce((acc, b) => {
                          // Find config for this building to see if it uses this tier
                          // We need to look up BUILDING_TYPES but here we can just use total tier jobs
                          acc[b.type] = (acc[b.type] || 0) + 1
                          return acc
                        }, {} as Record<string, number>)
                      ).map(([type, amount]) => {
                         // Only show if the building actually requires this tier
                         // To do this we should probably pass BUILDING_TYPES or import it. Wait, I imported it in building.production but not here. Let's do a simpler check.
                         return null
                      })
                    }
                    {/* Proper jobs list */}
                    <JobList buildings={buildings} tier={tierKey} count={count} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

function JobList({ buildings, tier, count }: { buildings: BuildingRow[], tier: PopulationTier, count: number }) {
  // Aggregate buildings of this tier
  // We need BUILDING_TYPES. Let's import it inside the file or above
  return <JobListInner buildings={buildings} tier={tier} />
}

import { BUILDING_TYPES } from '@/domains/building/building.config'

function JobListInner({ buildings, tier }: { buildings: BuildingRow[], tier: PopulationTier }) {
  const jobMap: Record<string, number> = {}
  let totalJobs = 0
  for (const b of buildings) {
    if (!b.is_active) continue
    const conf = BUILDING_TYPES[b.type]
    if (conf && conf.workforce.tier === tier && conf.workforce.count > 0) {
      jobMap[b.type] = (jobMap[b.type] || 0) + conf.workforce.count
      totalJobs += conf.workforce.count
    }
  }

  if (totalJobs === 0) {
    return <span className="text-gray-500 text-sm">Нет рабочих мест</span>
  }

  return (
    <>
      {Object.entries(jobMap).map(([type, reqCount]) => (
        <span key={type} className="text-xs bg-black/40 border border-white/10 px-2 py-1 rounded text-gray-300">
          {BUILDING_TYPES[type as keyof typeof BUILDING_TYPES]?.name} (×{reqCount})
        </span>
      ))}
    </>
  )
}

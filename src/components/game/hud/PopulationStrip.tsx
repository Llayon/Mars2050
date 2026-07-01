import type { PopulationState } from '@/domains/population/population.types'

interface PopulationStripProps {
  population: PopulationState | null
  isMobile?: boolean
}

export function PopulationStrip({ population, isMobile }: PopulationStripProps) {
  const workers = population?.workers || 0
  const technicians = population?.technicians || 0
  const scientists = population?.scientists || 0
  const directors = population?.directors || 0
  const totalPop = workers + technicians + scientists + directors
  
  const housingCapacity = '—'

  let weightedHappiness = 100
  if (totalPop > 0 && population) {
    weightedHappiness = Math.round(
      ((population.happiness_workers || 0) * workers +
      (population.happiness_technicians || 0) * technicians +
      (population.happiness_scientists || 0) * scientists +
      (population.happiness_directors || 0) * directors) / totalPop
    )
  }

  const hasWorkerWarning = workers === 0
  const lowHappiness = weightedHappiness < 50

  if (isMobile) {
    return (
      <div className="flex justify-around items-center text-[10px] w-full">
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
    )
  }

  return (
    <div className="flex items-center gap-4 text-xs font-bold shrink-0">
      <div className="flex items-center gap-2 text-gray-200" title={`Рабочие: ${workers} | Инженеры: ${technicians} | Ученые: ${scientists}`}>
        <span className="opacity-80 drop-shadow-md">👥</span> 
        <span>{totalPop} <span className="text-gray-500 font-normal">/ {housingCapacity}</span></span>
      </div>
      <div className={`flex items-center gap-1.5 ${lowHappiness ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
        <span className="opacity-80 drop-shadow-md">😊</span> 
        <span>{weightedHappiness}%</span>
      </div>
    </div>
  )
}

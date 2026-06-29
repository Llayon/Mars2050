import type { PopulationState } from '@/domains/population/population.types'

interface GameAlertsProps {
  population: PopulationState | null
  housingCapacity?: string | number
}

export function GameAlerts({ population, housingCapacity = '—' }: GameAlertsProps) {
  const workers = population?.workers || 0
  const technicians = population?.technicians || 0
  const scientists = population?.scientists || 0
  const directors = population?.directors || 0
  
  const totalPop = workers + technicians + scientists + directors
  const hasWorkerWarning = workers === 0
  
  // We can only reliably show housing warning if we have a real number
  const hasHousingWarning = typeof housingCapacity === 'number' && totalPop > housingCapacity
  
  const alerts = []
  
  if (hasWorkerWarning) {
    alerts.push({ id: 'workers', label: 'Нет рабочих', type: 'critical' })
  }
  if (hasHousingWarning) {
    alerts.push({ id: 'housing', label: 'Нехватка жилья', type: 'warning' })
  }

  if (alerts.length === 0) return null

  return (
    <div className="absolute left-2 top-24 z-30 flex flex-col gap-2 pointer-events-auto">
      {alerts.map(alert => (
        <div 
          key={alert.id}
          className={`group flex items-center gap-3 p-2 rounded-r-lg border-l-4 bg-black/60 backdrop-blur text-xs font-bold uppercase tracking-wider cursor-help transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
            alert.type === 'critical' 
              ? 'border-red-500 text-red-400 hover:bg-red-900/30' 
              : 'border-amber-500 text-amber-400 hover:bg-amber-900/30'
          }`}
          title={alert.label}
        >
          {alert.type === 'critical' ? (
             <div className="w-3 h-3 rounded-sm bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          ) : (
             <div className="w-3 h-3 bg-amber-500 rotate-45 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          )}
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 ease-in-out">
            {alert.label}
          </span>
        </div>
      ))}
    </div>
  )
}

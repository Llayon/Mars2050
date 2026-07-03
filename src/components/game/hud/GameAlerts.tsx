import type { PopulationState } from '@/domains/population/population.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'
import { useEvents } from '@/hooks/useEvents'
import { EVENT_CONFIG } from '@/domains/events/events.config'

interface GameAlertsProps {
  colonyId: string
  population: PopulationState | null
  resources: ResourceRow[]
  housingCapacity?: string | number
}

type AlertType = 'critical' | 'warning' | 'info'

interface AlertItem {
  id: string
  label: string
  value?: string | React.ReactNode
  icon?: string | React.ReactNode
  type: AlertType
}

export function GameAlerts({ colonyId, population, resources, housingCapacity = '—' }: GameAlertsProps) {
  const { events } = useEvents(colonyId, { processOnMount: false, subscribePending: false })
  
  const workers = population?.workers || 0
  const totalPop = workers + (population?.technicians || 0) + (population?.scientists || 0) + (population?.directors || 0)
  
  const hasWorkerWarning = workers === 0
  const hasHousingWarning = typeof housingCapacity === 'number' && totalPop > housingCapacity

  const alerts: AlertItem[] = []

  // 1. Critical Population Alerts
  if (hasWorkerWarning) {
    alerts.push({ id: 'workers', icon: <span className="text-red-400"><ResourceIcon type="worker" className="w-4 h-4" /></span>, label: 'Нет рабочих', value: '0', type: 'critical' })
  }
  if (hasHousingWarning) {
    alerts.push({ id: 'housing', icon: <span className="text-amber-400"><ResourceIcon type="housing" className="w-4 h-4" /></span>, label: 'Нехватка жилья', value: `${totalPop}/${housingCapacity}`, type: 'warning' })
  }

  // 2. Resource Deficits
  const criticalResources = ['energy', 'oxygen', 'water', 'food']
  criticalResources.forEach(resType => {
    const res = resources.find(r => r.type === resType)
    if (res) {
      const net = res.production_rate - res.consumption_rate
      // Total blackout/starvation
      if (res.amount <= 0 && net < 0) {
        alerts.push({ 
          id: `starve_${resType}`, 
          icon: <span className="text-red-400"><ResourceIcon type={resType} className="w-4 h-4" /></span>, 
          label: `Критический дефицит ${RESOURCE_NAMES[resType] || resType}`, 
          value: '0',
          type: 'critical' 
        })
      } 
      // Draining stock
      else if (net < 0) {
        alerts.push({ 
          id: `drain_${resType}`, 
          icon: <span className="text-amber-400"><ResourceIcon type={resType} className="w-4 h-4" /></span>, 
          label: `Убыль ${RESOURCE_NAMES[resType] || resType}`, 
          value: Math.round(net).toString(),
          type: 'warning' 
        })
      }
    }
  })

  // 3. Active Events
  events.forEach(event => {
    // If it has a duration and ends_at, we can show time. For now just show active.
    let timeStr = 'Активно'
    if (event.ends_at) {
      const diffMs = new Date(event.ends_at).getTime() - new Date().getTime()
      if (diffMs > 0) {
        const mins = Math.floor(diffMs / 60000)
        timeStr = mins > 0 ? `${mins} мин` : '<1 мин'
      }
    }
    // We assume event.type is EventType since it comes from our backend
    const config = EVENT_CONFIG[event.type as keyof typeof EVENT_CONFIG]
    alerts.push({
      id: `evt_${event.id}`,
      icon: '⚠️',
      label: config?.name || event.name,
      value: timeStr,
      type: 'critical' // Events are mostly bad in this context
    })
  })

  if (alerts.length === 0) return null

  return (
    <div className="absolute left-2 top-24 z-30 flex flex-col gap-2 pointer-events-auto">
      {alerts.map(alert => (
        <div 
          key={alert.id}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-r-lg border-l-4 bg-black/70 backdrop-blur-md text-xs font-bold uppercase tracking-wider cursor-default shadow-[0_0_15px_rgba(0,0,0,0.6)] transition-all duration-300 ${
            alert.type === 'critical' 
              ? 'border-red-500 text-red-400 hover:bg-red-900/40' 
              : alert.type === 'warning'
                ? 'border-amber-500 text-amber-400 hover:bg-amber-900/40'
                : 'border-cyan-500 text-cyan-400 hover:bg-cyan-900/40'
          }`}
          title={alert.label}
        >
          {/* Status Indicator */}
          {alert.type === 'critical' ? (
             <div className="w-2 h-2 rounded-sm bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          ) : alert.type === 'warning' ? (
             <div className="w-2 h-2 bg-amber-500 rotate-45 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          ) : (
             <div className="w-2 h-2 rounded-full bg-cyan-500 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          )}
          
          {/* Icon & Value (Always visible) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm">{alert.icon}</span>
            <span className="text-white tabular-nums">{alert.value}</span>
          </div>
          
          {/* Separator & Label (Hidden by default, slides out on hover) */}
          <div className="flex items-center overflow-hidden max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 transition-all duration-300 ease-in-out">
            <div className="w-px h-4 bg-white/20 mx-2 shrink-0" />
            <span className="text-[10px] text-gray-300 whitespace-nowrap">
              {alert.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

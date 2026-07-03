import type { ResourceRow, ResourceTypeKey } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourceIcon } from '@/components/ui/icons/ResourceIcon'

interface ResourceStripProps {
  resources: ResourceRow[]
  isMobile?: boolean
}

export function ResourceStrip({ resources, isMobile }: ResourceStripProps) {
  const orderedKeys: ResourceTypeKey[] = ['energy', 'minerals', 'water', 'oxygen', 'food', 'research_points']
  const displayResources = orderedKeys.map(key => {
    const res = resources.find(r => r.type === key)
    return res || { type: key, amount: 0, capacity: 0, production_rate: 0, consumption_rate: 0 }
  })

  if (isMobile) {
    return (
      <div data-testid="resource-strip" className="flex gap-3 overflow-x-auto custom-scrollbar no-scrollbar text-[10px] items-center">
        {displayResources.slice(0, 4).map(res => {
          const delta = res.production_rate - res.consumption_rate
          const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
          const roundedDelta = Math.round(delta)
          const title = `${RESOURCE_NAMES[res.type] || res.type}: ${Math.floor(res.amount).toLocaleString('ru-RU')}/${Math.floor(res.capacity).toLocaleString('ru-RU')}`
          return (
            <div key={res.type} className="flex items-center gap-1 shrink-0" title={title}>
              <span className="text-cyan-400 drop-shadow-md"><ResourceIcon type={res.type} className="w-3.5 h-3.5" /></span>
              <span className="font-bold text-white">{Math.floor(res.amount)}</span>
              <span className={`${deltaColor}`}>
                {roundedDelta > 0 ? '+' : ''}{roundedDelta}/h
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div data-testid="resource-strip" className="flex gap-6 items-center shrink-0">
      {displayResources.map(res => {
        const delta = res.production_rate - res.consumption_rate
        const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'
        const roundedDelta = Math.round(delta)
        const name = `${RESOURCE_NAMES[res.type] || res.type}: ${Math.floor(res.amount).toLocaleString('ru-RU')}/${Math.floor(res.capacity).toLocaleString('ru-RU')}`
        return (
          <div key={res.type} className="flex items-center gap-2 group cursor-default" title={name}>
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
  )
}

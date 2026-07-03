import type { ResourceRow } from '@/domains/resource/resource.types'
import type { PopulationState } from '@/domains/population/population.types'
import type { Colony } from '@/domains/colony/colony.types'

import { ColonyStatusBlock } from './ColonyStatusBlock'
import { PopulationStrip } from './PopulationStrip'
import { ResourceStrip } from './ResourceStrip'

interface GameTopHeaderProps {
  resources: ResourceRow[]
  population: PopulationState | null
  colony: Colony | null
  isMobile?: boolean
}

export function GameTopHeader({ resources, population, colony, isMobile }: GameTopHeaderProps) {
  if (isMobile) {
    // Mobile: Ultra compact, two stacked rows
    return (
      <div data-testid="top-hud" className="absolute top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 p-2 flex flex-col gap-1 pointer-events-auto shadow-[0_0_15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center text-xs">
          <ColonyStatusBlock colony={colony} isMobile={true} />
          <ResourceStrip resources={resources} isMobile={true} />
        </div>
        <div className="bg-slate-900/50 rounded py-0.5 border border-slate-700/50">
          <PopulationStrip population={population} isMobile={true} />
        </div>
      </div>
    )
  }

  // Desktop: Unified Full-Width Header (Anno Style - minimal)
  return (
    <div data-testid="top-hud" className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-2 pb-8 px-6 flex justify-between items-start pointer-events-none">
      
      {/* Left: Colony Info */}
      <div className="pointer-events-auto mt-2">
        <ColonyStatusBlock colony={colony} />
      </div>
      
      {/* Center: Global Resources & Population */}
      <div className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 pointer-events-auto shadow-2xl mt-1">
        
        {/* Population Compact */}
        <div className="flex gap-4 items-center mr-6">
          <PopulationStrip population={population} />
        </div>

        <div className="w-px h-5 bg-white/10 mr-6"></div>

        {/* Resources */}
        <ResourceStrip resources={resources} />
      </div>

      {/* Right: Placeholder for symmetry */}
      <div className="w-32"></div>
    </div>
  )
}

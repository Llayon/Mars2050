interface CommandDockProps {
  activeView: 'colony' | 'map'
  onViewChange: (view: 'colony' | 'map') => void
  onToggleArmy: () => void
  onToggleBuild: () => void
  onToggleIntel: () => void
  armyOpen?: boolean
  buildOpen?: boolean
  intelOpen?: boolean
}

export function CommandDock({
  activeView,
  onViewChange,
  onToggleArmy,
  onToggleBuild,
  onToggleIntel,
  armyOpen,
  buildOpen,
  intelOpen
}: CommandDockProps) {
  
  const baseTabClass = "flex-1 flex items-center justify-center gap-2 px-8 py-3 font-bold text-xs tracking-widest uppercase transition-colors"
  
  // Style generator for tabs
  const getTabStyle = (isActive: boolean, colorClass: string, isPurple = false) => {
    if (isActive) {
      return `text-${colorClass}-300 bg-${colorClass}-900/20 shadow-[inset_0_-2px_0_rgba(var(--tw-colors-${colorClass}-400))]`
    }
    return `text-gray-400 hover:text-${colorClass}-200 hover:bg-gray-800/50`
  }

  return (
    <div data-testid="command-dock" className="absolute bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      {/* Command Dock Container */}
      <div className="pointer-events-auto bg-gray-900/80 backdrop-blur-xl border-t border-l border-r border-gray-700/80 rounded-t-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden flex">
        
        {/* Navigation Section */}
        <div className="flex border-r border-gray-700/50">
          <button 
            onClick={() => onViewChange('colony')} 
            data-testid="command-dock-colony"
            className={`${baseTabClass} ${activeView === 'colony' ? 'text-cyan-300 bg-cyan-900/20 shadow-[inset_0_-2px_0_#22d3ee]' : 'text-gray-400 hover:text-cyan-200 hover:bg-gray-800/50'}`}
          >
            <span className={`w-2 h-2 ${activeView === 'colony' ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-gray-500 rounded-full'}`} />
            База
          </button>
          
          <div className="w-px bg-gray-700/50 my-2"></div>
          
          <button 
            onClick={() => onViewChange('map')} 
            data-testid="command-dock-map"
            className={`${baseTabClass} ${activeView === 'map' ? 'text-cyan-300 bg-cyan-900/20 shadow-[inset_0_-2px_0_#22d3ee]' : 'text-gray-400 hover:text-cyan-200 hover:bg-gray-800/50'}`}
          >
            <span className={`w-2 h-2 ${activeView === 'map' ? 'bg-cyan-400 rotate-45 shadow-[0_0_8px_#22d3ee]' : 'bg-gray-500 rotate-45'}`} />
            Карта
          </button>
        </div>

        {/* Action Section */}
        <div className="flex border-r border-gray-700/50">
          <button 
            onClick={onToggleArmy} 
            data-testid="command-dock-army"
            className={`${baseTabClass} ${armyOpen ? 'text-cyan-300 bg-cyan-900/20 shadow-[inset_0_-2px_0_#22d3ee]' : 'text-gray-400 hover:text-cyan-200 hover:bg-gray-800/50'}`}
          >
            <span className={`w-2 h-2 border-t-2 border-r-2 ${armyOpen ? 'border-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'border-gray-500'} rotate-45`} />
            Армия
          </button>
          
          <div className="w-px bg-gray-700/50 my-2"></div>

          <button 
            onClick={onToggleBuild} 
            data-testid="command-dock-build"
            className={`${baseTabClass} ${buildOpen ? 'text-cyan-300 bg-cyan-900/20 shadow-[inset_0_-2px_0_#22d3ee]' : 'text-gray-400 hover:text-cyan-200 hover:bg-gray-800/50'}`}
          >
            <span className={`w-2 h-2 border-2 ${buildOpen ? 'border-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'border-gray-500'}`} />
            Стройка
          </button>
        </div>

        {/* Intel Section */}
        <div className="flex">
          <button 
            onClick={onToggleIntel} 
            data-testid="command-dock-intel"
            className={`${baseTabClass} ${intelOpen ? 'text-purple-300 bg-purple-900/20 shadow-[inset_0_-2px_0_#c084fc]' : 'text-gray-400 hover:text-purple-200 hover:bg-gray-800/50'}`}
          >
            <span className={`w-2 h-2 ${intelOpen ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]' : 'bg-gray-500'} rounded-sm`} />
            Данные
          </button>
        </div>

      </div>
    </div>
  )
}

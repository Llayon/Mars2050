interface ActionBottomBarProps {
  activeView: 'colony' | 'map'
  onViewChange: (view: 'colony' | 'map') => void
  onToggleArmy: () => void
  onToggleBuild: () => void
  onToggleManagement: () => void
  onToggleIntel: () => void
}

export function ActionBottomBar({
  activeView,
  onViewChange,
  onToggleArmy,
  onToggleBuild,
  onToggleManagement,
  onToggleIntel
}: ActionBottomBarProps) {
  
  const baseTabClass = "px-6 py-2.5 rounded-t-lg font-bold text-xs tracking-widest uppercase transition-all border-t border-l border-r relative flex items-center gap-2"
  const inactiveTabClass = "bg-black/60 border-cyan-900/30 text-gray-400 hover:text-cyan-300 hover:bg-black/80 hover:border-cyan-500/50"
  const activeTabClass = "bg-cyan-900/40 border-cyan-400 text-white shadow-[0_-5px_15px_rgba(6,182,212,0.15)]"

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="flex gap-1 items-end pointer-events-auto">
        <button 
          onClick={() => onViewChange('colony')} 
          className={`${baseTabClass} ${activeView === 'colony' ? activeTabClass : inactiveTabClass}`}
        >
          <span className={`w-2 h-2 ${activeView === 'colony' ? 'bg-cyan-400' : 'bg-gray-500 rounded-full'}`} />
          База
          {activeView === 'colony' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />}
        </button>
        
        <button 
          onClick={() => onViewChange('map')} 
          className={`${baseTabClass} ${activeView === 'map' ? activeTabClass : inactiveTabClass}`}
        >
          <span className={`w-2 h-2 ${activeView === 'map' ? 'bg-cyan-400 rotate-45' : 'bg-gray-500 rotate-45'}`} />
          Карта
          {activeView === 'map' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />}
        </button>

        <button 
          onClick={onToggleArmy} 
          className={`${baseTabClass} ${inactiveTabClass}`}
        >
          <span className="w-2 h-2 border-t-2 border-r-2 border-gray-500 rotate-45" />
          Армия
        </button>

        <button 
          onClick={onToggleBuild} 
          className={`${baseTabClass} ${inactiveTabClass}`}
        >
          <span className="w-2 h-2 border-2 border-gray-500" />
          Стройка
        </button>

        {/* Separator / Spacer */}
        <div className="w-8"></div>

        <button 
          onClick={onToggleIntel} 
          className="px-6 py-2 mb-1 rounded font-bold text-xs tracking-widest uppercase transition-all bg-purple-900/40 border border-purple-500/50 hover:border-purple-400 hover:text-purple-200 text-purple-300 flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
        >
          <span className="w-2 h-2 bg-purple-400 rounded-sm shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          Данные
        </button>
      </div>
    </div>
  )
}

import { ReactNode } from 'react'

interface LegacyPanelsDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function LegacyPanelsDrawer({ isOpen, onClose, children }: LegacyPanelsDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 z-40 bg-black/50 transition-opacity duration-300 pointer-events-auto ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`absolute top-0 bottom-0 left-0 z-50 w-96 bg-gray-900 border-r border-cyan-500/30 p-4 overflow-y-auto custom-scrollbar transition-transform duration-300 pointer-events-auto shadow-[10px_0_30px_rgba(0,0,0,0.8)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-cyan-400">Управление (Legacy)</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </>
  )
}

import { ReactNode } from 'react'
import { HudPanel } from './HudPanel'

interface HudBottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function HudBottomSheet({ open, onClose, children }: HudBottomSheetProps) {
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <HudPanel 
        chamfer={false} 
        className="relative w-full rounded-t-2xl p-4 pb-8 max-h-[70vh] animate-slide-up border-b-0 hud-chamfer-reverse" 
      >
        <div 
          className="w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-gray-500/50 rounded-full mx-auto mb-4" />
          {children}
        </div>
      </HudPanel>
    </div>
  )
}

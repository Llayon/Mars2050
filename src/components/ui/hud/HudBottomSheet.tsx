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
    <div 
      data-testid="hud-bottom-sheet"
      className="fixed inset-0 z-40 flex items-end" 
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
      onPointerMove={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <HudPanel 
        chamfer={false} 
        className="relative w-full rounded-t-2xl p-4 pb-20 max-h-[75vh] flex flex-col animate-slide-up border-b-0 hud-chamfer-reverse" 
      >
        <div className="w-12 h-1.5 shrink-0 bg-gray-500/50 rounded-full mx-auto mb-4 cursor-pointer" />
        <div 
          className="flex-1 w-full overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </HudPanel>
    </div>
  )
}

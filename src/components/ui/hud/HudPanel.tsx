import { ReactNode } from 'react'

export function HudPanel({ children, className = '', chamfer = true }: { children: ReactNode, className?: string, chamfer?: boolean }) {
  return (
    <div className={`hud-panel ${chamfer ? 'hud-chamfer' : 'rounded-xl'} ${className}`}>
      {children}
    </div>
  )
}

import { ReactNode, ButtonHTMLAttributes } from 'react'

interface HudButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline'
  chamfer?: boolean
}

export function HudButton({ children, className = '', variant = 'primary', chamfer = true, ...props }: HudButtonProps) {
  const baseStyle = "font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
  
  const variants = {
    primary: "bg-mars-red hover:bg-red-700 text-white hud-text-glow",
    danger: "bg-red-900/40 border border-red-500/50 text-red-400 hover:bg-red-900/60",
    ghost: "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white",
    outline: "border border-mars-border text-mars-orange hover:bg-mars-orange/10",
  }

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${chamfer ? 'hud-chamfer' : 'rounded-lg'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

import type { Colony } from '@/domains/colony/colony.types'

interface ColonyStatusBlockProps {
  colony: Colony | null
  isMobile?: boolean
}

export function ColonyStatusBlock({ colony, isMobile }: ColonyStatusBlockProps) {
  if (isMobile) {
    return (
      <div className="flex items-center gap-1 font-bold">
        <span className="text-cyan-400 bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/50">
          Lv. {colony?.level || 1}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col shrink-0">
      <div className="text-xl font-serif text-white tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
        {colony?.name || 'Base: Alpha'}
      </div>
      <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-1">
        Уровень {colony?.level || 1}
      </div>
    </div>
  )
}

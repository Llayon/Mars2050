'use client'

import { useCombat } from '@/hooks/useCombat'
import { DeploymentPlanner } from '@/components/game/DeploymentBoard'
import { useToast } from '@/components/ui/toast'

export function DefenseTab({ colonyId }: { colonyId: string }) {
  const { units, saveGarrison, isLoading } = useCombat(colonyId)
  const { toast } = useToast()
  
  if (isLoading) {
    return <div className="p-12 text-center text-cyan-500 animate-pulse font-mono uppercase tracking-widest">Accessing Tactical Grid...</div>
  }

  // Filter out destroyed units for garrison
  const availableUnits = units.filter(u => u.hp_current > 0)

  return (
    <div className="h-full w-full bg-slate-900/40 relative">
      <DeploymentPlanner 
        mode="defense" 
        units={availableUnits} 
        saveLabel="СОХРАНИТЬ РАССТАНОВКУ"
        onSave={async (placement) => {
          try {
            const res = await saveGarrison(placement.map(p => ({ unitId: p.unitId, x: p.x, y: p.y })))
            if (res.error) throw new Error(res.error)
            toast('Оборонительная расстановка сохранена!', 'success')
          } catch (e: unknown) {
            toast(e instanceof Error ? e.message : 'Ошибка сохранения расстановки', 'error')
          }
        }} 
      />
    </div>
  )
}

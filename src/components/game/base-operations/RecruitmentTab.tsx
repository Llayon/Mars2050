import { useState } from 'react'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitTypeKey } from '@/domains/combat/combat.types'
import { useCombat } from '@/hooks/useCombat'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { useToast } from '@/components/ui/toast'

interface RecruitmentTabProps {
  colonyId: string
  resources: ResourceRow[]
}

export function RecruitmentTab({ colonyId, resources }: RecruitmentTabProps) {
  const { units, hireUnit, isLoading } = useCombat(colonyId)
  const { toast } = useToast()
  
  // Bulk hire state
  const [queues, setQueues] = useState<Record<UnitTypeKey, number>>({} as Record<UnitTypeKey, number>)
  const [isHiring, setIsHiring] = useState(false)

  const updateQueue = (type: UnitTypeKey, delta: number) => {
    setQueues(prev => {
      const current = prev[type] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [type]: next }
    })
  }

  const handleHire = async (type: UnitTypeKey) => {
    const count = queues[type] || 0
    if (count <= 0) return

    setIsHiring(true)
    let successes = 0
    let errors = 0
    
    // Sequential hire to support bulk without changing backend yet
    for (let i = 0; i < count; i++) {
      const res = await hireUnit(type)
      if (res.success) successes++
      else errors++
    }
    
    setIsHiring(false)
    if (successes > 0) toast(`Успешно нанято: ${successes}`, 'success')
    if (errors > 0) toast(`Ошибок найма: ${errors}`, 'error')
    
    // Reset queue for this type
    setQueues(prev => ({ ...prev, [type]: 0 }))
  }

  // Calculate Army Summary
  const armySummary = { infantry: 0, vehicles: 0, aircraft: 0 }
  units?.forEach(u => {
    const config = UNIT_TYPES[u.unit_type as UnitTypeKey]
    if (!config) return
    if (config.baseStats.combatTags?.includes('infantry')) armySummary.infantry++
    else if (config.baseStats.combatTags?.includes('vehicle')) armySummary.vehicles++
    else if (config.baseStats.combatTags?.includes('aircraft') || config.baseStats.isFlying) armySummary.aircraft++
  })

  return (
    <div className="absolute inset-0 flex">
      {/* Left Area: Unit List */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-black">
        <div className="mb-6 flex gap-2">
          <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest border border-cyan-500 text-cyan-300 rounded">All Forces</button>
          <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 border border-gray-700 rounded hover:border-cyan-500 hover:text-cyan-300">Infantry</button>
          <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 border border-gray-700 rounded hover:border-cyan-500 hover:text-cyan-300">Vehicles</button>
        </div>

        <div className="space-y-3">
          {Object.entries(UNIT_TYPES)
            .filter(([_, config]) => config.hireCost && Object.keys(config.hireCost).length > 0)
            .map(([type, config]) => {
            const queueCount = queues[type as UnitTypeKey] || 0
            const totalCost = Object.entries(config.hireCost || {}).map(([resType, amt]) => ({ resType, amt: amt * Math.max(1, queueCount) }))
            
            const canAfford = totalCost.every(({ resType, amt }) => {
              const r = resources.find(r => r.type === resType)
              return r && r.amount >= amt
            })

            return (
              <div key={type} className="flex items-center gap-4 bg-gray-800/40 border border-gray-700 p-4 rounded hover:border-cyan-900 transition-colors">
                <div className="w-48 flex-none">
                  <h3 className="font-bold text-white text-sm">{config.name}</h3>
                  <div className="text-xs text-gray-500 uppercase tracking-widest">{config.baseStats.combatTags?.join(' / ') || 'Structure'}</div>
                </div>

                <div className="flex-1 flex gap-4 text-xs">
                  {totalCost.map(({ resType, amt }) => {
                    const r = resources.find(r => r.type === resType)
                    const hasEnough = r && r.amount >= amt
                    return (
                      <span key={resType} className={`flex items-center gap-1 ${hasEnough ? 'text-gray-300' : 'text-red-400'}`}>
                        {RESOURCE_NAMES[resType] || resType}: {amt}
                      </span>
                    )
                  })}
                  {totalCost.length === 0 && <span className="text-gray-500">Бесплатно</span>}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => updateQueue(type as UnitTypeKey, -1)} className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold">-</button>
                  <span className="w-8 text-center font-mono text-cyan-300 font-bold">{queueCount}</span>
                  <button onClick={() => updateQueue(type as UnitTypeKey, 1)} className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white font-bold">+</button>
                </div>

                <button 
                  onClick={() => handleHire(type as UnitTypeKey)}
                  disabled={queueCount === 0 || !canAfford || isHiring}
                  className={`w-32 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors ${
                    queueCount > 0 && canAfford && !isHiring ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {isHiring ? 'HIRING...' : 'QUEUE'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Area: Army Summary */}
      <div className="w-80 flex-none border-l border-cyan-900/50 bg-black/60 p-6 flex flex-col">
        <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-6">Current Forces</h2>
        
        {isLoading ? (
          <div className="text-gray-500 animate-pulse text-sm">Scanning signatures...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-300">Infantry</span>
              <span className="text-cyan-400 font-mono">{armySummary.infantry}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-300">Vehicles</span>
              <span className="text-cyan-400 font-mono">{armySummary.vehicles}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-300">Aircraft</span>
              <span className="text-cyan-400 font-mono">{armySummary.aircraft}</span>
            </div>
            <div className="flex justify-between border-b border-cyan-900/50 pb-2 pt-2 mt-2">
              <span className="text-white font-bold">Total Units</span>
              <span className="text-cyan-400 font-mono font-bold">{units?.length || 0}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

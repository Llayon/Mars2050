'use client'

import { memo, useState } from 'react'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitTypeKey } from '@/domains/combat/combat.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { useCombat } from '@/hooks/useCombat'
import { useToast } from '@/components/ui/toast'

interface ArmyPanelProps {
  colonyId: string
  resources: ResourceRow[]
}

export const ArmyPanel = memo(function ArmyPanel({ colonyId, resources }: ArmyPanelProps) {
  const { units, isLoading, hireUnit, dismissUnit } = useCombat(colonyId)
  const [showMenu, setShowMenu] = useState(false)
  const [isHiring, setIsHiring] = useState<string | null>(null)
  const { toast } = useToast()

  async function handleHire(type: UnitTypeKey) {
    const config = UNIT_TYPES[type]
    if (!config) return

    const canAfford = Object.entries(config.hireCost).every(([k, v]) => {
      const res = resources.find(r => r.type === k)
      return res && res.amount >= v
    })

    if (!canAfford) {
      toast('Недостаточно ресурсов', 'error')
      return
    }

    setIsHiring(type)
    try {
      const res = await hireUnit(type)
      if (res.error) throw new Error(res.error)
      toast(`${config.name} нанят!`, 'success')
      setShowMenu(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка найма'
      toast(msg, 'error')
    } finally {
      setIsHiring(null)
    }
  }

  async function handleDismiss(unitId: string, name: string) {
    if (!confirm(`Точно уволить юнита ${name}? Вернется 50% стоимости.`)) return
    
    try {
      const res = await dismissUnit(unitId)
      if (res.error) throw new Error(res.error)
      toast(`Юнит уволен`, 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка увольнения'
      toast(msg, 'error')
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Армия ({units.length})</h2>
        <button onClick={() => setShowMenu(!showMenu)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm text-white">
          {showMenu ? 'Отмена' : '+ Нанять'}
        </button>
      </div>

      {showMenu && (
        <div className="mb-4 bg-gray-700 p-3 rounded-md">
          <h3 className="font-semibold mb-2 text-white">Доступные классы:</h3>
          <div className="space-y-2">
            {Object.entries(UNIT_TYPES).map(([type, config]) => {
              const canAfford = Object.entries(config.hireCost).every(([k, v]) => {
                const res = resources.find(r => r.type === k)
                return res && res.amount >= v
              })
              return (
                <button
                  key={type}
                  onClick={() => handleHire(type as UnitTypeKey)}
                  disabled={isHiring !== null}
                  className={`w-full text-left p-2 rounded text-sm transition-colors text-white
                    ${canAfford ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{config.name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-800 rounded">HP: {config.baseStats.hp} | ATK: {config.baseStats.attack}</span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    Стоимость: {Object.entries(config.hireCost).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')}
                  </div>
                  {!canAfford && <div className="text-xs text-red-400 mt-1">Недостаточно ресурсов</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-sm text-center py-4">Загрузка армии...</div>
      ) : units.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4 bg-gray-700/50 rounded">Нет юнитов. Нажмите «Нанять», чтобы начать сборку отряда.</div>
      ) : (
        <div className="space-y-2">
          {units.map(unit => {
            const config = UNIT_TYPES[unit.unit_type as UnitTypeKey]
            return (
              <div key={unit.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-center text-sm text-white">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {config?.name || unit.unit_type}
                    <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">Tier {unit.tier}</span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    HP: {unit.hp_current}/{config?.baseStats.hp} • Атака: {config?.baseStats.attack} • Дальность: {config?.baseStats.range}
                  </div>
                  {unit.upgrade_path && unit.upgrade_path.length > 0 && (
                    <div className="text-xs text-purple-400 mt-1">Ветки: {unit.upgrade_path.join(' -> ')}</div>
                  )}
                </div>
                
                <button
                  onClick={() => handleDismiss(unit.id!, config?.name || unit.unit_type)}
                  className="bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded transition-colors text-xs ml-4 whitespace-nowrap"
                >
                  Уволить
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

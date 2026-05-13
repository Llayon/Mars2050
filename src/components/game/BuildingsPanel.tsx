'use client'

import { useState } from 'react'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal } from '@/components/ui/modal'

interface BuildingRow {
  id: string
  colony_id: string
  type: string
  name: string
  level: number
  is_active: boolean
}

interface BuildingsPanelProps {
  buildings: BuildingRow[]
  colonyId: string
  resources: ResourceRow[]
  onBuild: (type: BuildingTypeKey) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onRefresh: () => void
}

export function BuildingsPanel({ buildings, colonyId, resources, onBuild, onDemolish, onRefresh }: BuildingsPanelProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [building, setBuilding] = useState<string | null>(null)
  const [demolishTarget, setDemolishTarget] = useState<BuildingRow | null>(null)
  const { toast } = useToast()

  async function handleBuild(type: BuildingTypeKey) {
    const config = BUILDING_TYPES[type]
    if (!config) return
    const canAfford = Object.entries(config.cost).every(([k, v]) => {
      const res = resources.find(r => r.type === k)
      return res && res.amount >= v
    })
    if (!canAfford) {
      toast('Недостаточно ресурсов', 'error')
      return
    }
    setBuilding(type)
    try {
      await onBuild(type)
      await onRefresh()
      toast(`${config.name} построен!`, 'success')
      setShowMenu(false)
    } catch (e: any) {
      toast(e.message || 'Ошибка строительства', 'error')
    } finally {
      setBuilding(null)
    }
  }

  async function handleDemolish() {
    if (!demolishTarget) return
    try {
      await onDemolish(demolishTarget.id)
      await onRefresh()
      toast(`${demolishTarget.name} снесён`, 'success')
    } catch (e: any) {
      toast(e.message || 'Ошибка сноса', 'error')
    }
    setDemolishTarget(null)
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Здания колонии ({buildings.length})</h2>
        <button onClick={() => setShowMenu(!showMenu)} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm text-white">
          {showMenu ? 'Отмена' : '+ Построить'}
        </button>
      </div>

      {showMenu && (
        <div className="mb-4 bg-gray-700 p-3 rounded-md">
          <h3 className="font-semibold mb-2 text-white">Доступные постройки:</h3>
          <div className="space-y-2">
            {Object.entries(BUILDING_TYPES).map(([type, config]) => {
              const canAfford = Object.entries(config.cost).every(([k, v]) => {
                const res = resources.find(r => r.type === k)
                return res && res.amount >= v
              })
              return (
                <button
                  key={type}
                  onClick={() => handleBuild(type as BuildingTypeKey)}
                  disabled={building !== null}
                  className={`w-full text-left p-2 rounded text-sm transition-colors text-white
                    ${canAfford ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
                >
                  <div className="font-semibold">{config.name}</div>
                  <div className="text-xs text-gray-300">
                    Стоимость: {Object.entries(config.cost).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')} | +{Object.entries(config.production).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')}/ч
                  </div>
                  {!canAfford && <div className="text-xs text-red-400 mt-1">Недостаточно ресурсов</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {buildings.map(b => (
          <div key={b.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-center">
            <div>
              <div className="font-semibold text-white">{b.name}</div>
              <div className="text-xs text-gray-300">Ур. {b.level} | {b.is_active ? '✅ Активно' : '❌ Неактивно'}</div>
            </div>
            <button onClick={() => setDemolishTarget(b)} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white">
              Снести
            </button>
          </div>
        ))}
        {buildings.length === 0 && <p className="text-gray-400 text-sm">Нет зданий. Постройте первое!</p>}
      </div>

      <ConfirmModal
        open={demolishTarget !== null}
        onClose={() => setDemolishTarget(null)}
        onConfirm={handleDemolish}
        title="Снос здания"
        message={`Вы уверены, что хотите снести «${demolishTarget?.name}»? Производство будет отменено.`}
        confirmText="Снести"
        danger
      />
    </div>
  )
}
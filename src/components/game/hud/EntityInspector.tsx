import { memo, useState, useEffect } from 'react'
import type { BuildingRow, BuildingSettingsUpdate } from '@/domains/building/building.types'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ConfirmModal } from '@/components/ui/modal'

interface EntityInspectorProps {
  building: BuildingRow | null
  onClose: () => void
  onDemolish: (id: string) => Promise<void>
  onUpdateSettings?: (id: string, settings: BuildingSettingsUpdate) => Promise<void>
  isMobile?: boolean
}

export const EntityInspector = memo(function EntityInspector({ building, onClose, onDemolish, onUpdateSettings, isMobile }: EntityInspectorProps) {
  const [confirmDemolish, setConfirmDemolish] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // For animation
  useEffect(() => {
    if (building) setIsVisible(true)
    else setIsVisible(false)
  }, [building])

  if (!building) return null

  const config = BUILDING_TYPES[building.type]
  if (!config) return null
  const staffing = config.staffing

  const handleDemolish = async () => {
    await onDemolish(building.id)
    setConfirmDemolish(false)
    onClose()
  }

  return (
    <>
      <div 
        className={`absolute z-40 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0 translate-x-0' : 'opacity-0 translate-y-8 md:translate-y-0 md:-translate-x-8 pointer-events-none'} 
        ${isMobile 
          ? 'bottom-6 left-4 right-4' // Mobile: floating at bottom
          : 'top-20 right-6 w-80'    // Desktop: anchored to top right
        }`}
      >
        <div className="bg-gray-900/95 backdrop-blur-xl border border-cyan-900/80 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="relative bg-gradient-to-r from-cyan-950/50 to-gray-900/50 p-4 border-b border-gray-800">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/60 rounded-xl flex items-center justify-center text-2xl border border-gray-800 shadow-inner">
                🏢
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{building.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 bg-cyan-950/50 px-2 py-0.5 rounded">
                    Уровень {building.level}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${building.paused ? 'text-orange-400' : building.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${building.paused ? 'bg-orange-400' : building.is_active ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {building.paused ? 'Пауза' : building.is_active ? 'Активно' : 'Остановлено'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Quick Actions overlaying header */}
            {onUpdateSettings && (
              <div className="absolute top-4 right-12 flex gap-2">
                <button
                  onClick={() => onUpdateSettings(building.id, { paused: !building.paused })}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                    building.paused 
                      ? 'bg-orange-900/50 border-orange-500/50 text-orange-400' 
                      : 'bg-black/40 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                  title={building.paused ? "Возобновить" : "Приостановить работу"}
                >
                  {building.paused ? '▶' : '⏸'}
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            
            {/* Description */}
            <p className="text-xs text-gray-400 leading-relaxed">
              {config.description}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 rounded-lg p-2 border border-gray-800/50">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1">Расположение</div>
                <div className="text-xs font-mono text-gray-300">[{building.x}, {building.y}]</div>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-gray-800/50">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1">Рабочие</div>
                <div className="text-xs font-mono text-cyan-300">
                  <span className="text-white">{building.assigned_workers}</span> / {staffing?.slots || 0}
                </div>
              </div>
            </div>

            {/* Staffing Controls */}
            {onUpdateSettings && staffing && staffing.slots > 0 && (
              <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Управление сменами</div>
                  <button
                    onClick={() => onUpdateSettings(building.id, { staffing_mode: building.staffing_mode === 'auto' ? 'manual' : 'auto' })}
                    className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                      building.staffing_mode === 'auto' 
                        ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800/50' 
                        : 'bg-orange-950/30 text-orange-400 border-orange-800/50'
                    }`}
                  >
                    {building.staffing_mode === 'auto' ? 'Авто' : 'Ручное'}
                  </button>
                </div>
                
                {building.staffing_mode === 'auto' ? (
                  <div className="flex gap-1">
                    {(['low', 'normal', 'high'] as const).map(prio => (
                      <button
                        key={prio}
                        onClick={() => onUpdateSettings(building.id, { work_priority: prio })}
                        className={`flex-1 py-1 text-[10px] rounded border uppercase tracking-wider font-bold transition-colors ${
                          building.work_priority === prio
                            ? 'bg-cyan-900/40 border-cyan-500/50 text-cyan-300'
                            : 'bg-black/50 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                        }`}
                      >
                        {prio === 'high' ? 'Выс' : prio === 'low' ? 'Низ' : 'Норм'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-black/60 rounded p-1 border border-gray-800">
                    <button 
                      onClick={() => onUpdateSettings(building.id, { assigned_workers: Math.max(0, building.assigned_workers - 1) })}
                      className="w-8 h-6 bg-gray-800/50 hover:bg-gray-700 rounded text-gray-300 flex items-center justify-center font-bold"
                    >-</button>
                    <div className="text-sm font-mono font-bold text-white">{building.assigned_workers}</div>
                    <button 
                      onClick={() => onUpdateSettings(building.id, { assigned_workers: Math.min(staffing.slots, building.assigned_workers + 1) })}
                      className="w-8 h-6 bg-gray-800/50 hover:bg-gray-700 rounded text-gray-300 flex items-center justify-center font-bold"
                    >+</button>
                  </div>
                )}
              </div>
            )}


            {/* Production / Consumption */}
            {(Object.keys(config.production).length > 0 || Object.keys(config.consumption).length > 0) && (
              <div className="bg-black/40 rounded-lg p-3 border border-gray-800/50 space-y-2">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Производительность (в час)</div>
                {Object.entries(config.production).map(([res, amt]) => (
                  <div key={res} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{RESOURCE_NAMES[res] || res}</span>
                    <span className="text-green-400 font-mono font-bold">+{amt}</span>
                  </div>
                ))}
                {Object.entries(config.consumption).map(([res, amt]) => (
                  <div key={res} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{RESOURCE_NAMES[res] || res}</span>
                    <span className="text-red-400 font-mono font-bold">-{amt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-gray-950/50 border-t border-gray-800 flex gap-2">
            <button 
              className="flex-1 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-800/50 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              disabled
            >
              Улучшить
            </button>
            <button 
              onClick={() => setConfirmDemolish(true)}
              className="px-4 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-900/50 py-2 rounded-xl text-xs font-bold uppercase transition-colors flex items-center justify-center"
              title="Снести"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDemolish}
        onClose={() => setConfirmDemolish(false)}
        onConfirm={handleDemolish}
        title="Снос здания"
        message={`Вы уверены, что хотите снести «${building.name}»? Производство будет отменено.`}
        confirmText="Снести"
        danger
      />
    </>
  )
})

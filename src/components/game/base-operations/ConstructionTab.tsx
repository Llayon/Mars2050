import { useState } from 'react'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'

interface ConstructionTabProps {
  buildings: BuildingRow[]
  resources: ResourceRow[]
  onBuild: (type: BuildingTypeKey) => Promise<void>
  onClose: () => void
}

export function ConstructionTab({ buildings, resources, onBuild, onClose }: ConstructionTabProps) {
  const [selectedType, setSelectedType] = useState<BuildingTypeKey | null>(null)

  const handleBuild = (type: BuildingTypeKey) => {
    onBuild(type)
    onClose() // Auto-close to enter placement mode
  }

  const selectedConfig = selectedType ? BUILDING_TYPES[selectedType] : null

  return (
    <div className="absolute inset-0 flex">
      {/* Left Area: Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-black">
        <div className="mb-6 flex gap-2">
          {['Energy', 'Extraction', 'Life Support', 'Industry', 'Research', 'Defense'].map(cat => (
            <button key={cat} className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 border border-gray-700 rounded hover:border-cyan-500 hover:text-cyan-300">
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(BUILDING_TYPES).map(([type, config]) => {
            const isSelected = selectedType === type
            const canAfford = Object.entries(config.cost).every(([k, v]) => {
              const res = resources.find(r => r.type === k)
              return res && res.amount >= v
            })

            return (
              <div 
                key={type} 
                onClick={() => setSelectedType(type as BuildingTypeKey)}
                className={`flex flex-col border ${isSelected ? 'border-cyan-400 bg-cyan-900/20' : 'border-gray-700 bg-gray-800/40 hover:border-cyan-700'} cursor-pointer p-4 rounded transition-colors group relative overflow-hidden`}
              >
                {/* Visual Flair */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <h3 className="font-bold text-white mb-2">{config.name}</h3>
                <div className="flex-1 space-y-2 text-sm text-gray-300 mb-4">
                  {/* Cost Summary */}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.cost).map(([resType, amount]) => {
                      const res = resources.find(r => r.type === resType)
                      const hasEnough = res && res.amount >= amount
                      return (
                        <span key={resType} className={`flex items-center gap-1 text-xs ${hasEnough ? 'text-gray-300' : 'text-red-400'}`}>
                          {RESOURCE_NAMES[resType] || resType}: {amount}
                        </span>
                      )
                    })}
                  </div>
                  {/* Production/Consumption Summary */}
                  {Object.keys(config.production).length > 0 && (
                    <div className="text-green-400 text-xs mt-1">
                      + {Object.keys(config.production).map(k => RESOURCE_NAMES[k] || k).join(', ')}
                    </div>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleBuild(type as BuildingTypeKey) }}
                  disabled={!canAfford}
                  className={`mt-auto px-4 py-2 text-xs font-bold uppercase tracking-widest rounded ${canAfford ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'} transition-colors`}
                >
                  BUILD
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Area: Selected Details */}
      <div className="w-80 flex-none border-l border-cyan-900/50 bg-black/60 p-6 overflow-y-auto">
        {selectedConfig ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">{selectedConfig.name}</h2>
              <p className="text-sm text-gray-400">{selectedConfig.description}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-800 pb-1">
                <span className="text-gray-500">Footprint</span>
                <span className="text-cyan-300 font-mono">{selectedConfig.width}x{selectedConfig.height}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-1">
                <span className="text-gray-500">Workforce</span>
                <span className="text-cyan-300">{selectedConfig.workforce.count > 0 ? `${selectedConfig.workforce.count} ${selectedConfig.workforce.tier}` : 'None'}</span>
              </div>
              {selectedConfig.requiresTerrain && (
                <div className="flex justify-between border-b border-gray-800 pb-1">
                  <span className="text-gray-500">Terrain</span>
                  <span className="text-amber-400">{selectedConfig.requiresTerrain.join(', ')}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cost</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(selectedConfig.cost).map(([resType, amount]) => {
                  const res = resources.find(r => r.type === resType)
                  const hasEnough = res && res.amount >= amount
                  return (
                    <div key={resType} className={`flex justify-between ${hasEnough ? 'text-gray-300' : 'text-red-400'}`}>
                      <span>{RESOURCE_NAMES[resType] || resType}</span>
                      <span className="font-mono">{amount}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {(Object.keys(selectedConfig.production).length > 0 || Object.keys(selectedConfig.consumption).length > 0) && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Output & Upkeep</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(selectedConfig.production).map(([res, amt]) => (
                    <div key={res} className="flex justify-between text-green-400">
                      <span>{RESOURCE_NAMES[res] || res}</span>
                      <span className="font-mono">+{amt}/h</span>
                    </div>
                  ))}
                  {Object.entries(selectedConfig.consumption).map(([res, amt]) => (
                    <div key={res} className="flex justify-between text-red-400">
                      <span>{RESOURCE_NAMES[res] || res}</span>
                      <span className="font-mono">-{amt}/h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-gray-500 text-sm">
            Select a structure to view details
          </div>
        )}
      </div>
    </div>
  )
}

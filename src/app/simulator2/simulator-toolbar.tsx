import Link from 'next/link'
import { TIER1_COMMAND_RULES } from '@/domains/combat/combat.tier1.config'
import { ReplayRendererSelector } from './simulator.components'
import { SIMULATOR_PRESET_OPTIONS } from './simulator.presets'
import type { SimulatorMode } from './simulator-tier1'

interface SimulatorToolbarProps {
  mode: SimulatorMode
  commandLimit: number
  seedInput: string
  replayRendererMode: 'canvas' | 'pixi'
  onLoadPreset: (presetId: string) => void
  onModeChange: (mode: SimulatorMode) => void
  onCommandLimitChange: (limit: number) => void
  onSeedChange: (seed: string) => void
  onRegenerateObstacles: () => void
  onReplayRendererChange: (mode: 'canvas' | 'pixi') => void
}

export function SimulatorToolbar({
  mode,
  commandLimit,
  seedInput,
  replayRendererMode,
  onLoadPreset,
  onModeChange,
  onCommandLimitChange,
  onSeedChange,
  onRegenerateObstacles,
  onReplayRendererChange,
}: SimulatorToolbarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold">🔬 Симулятор Боя (v2)</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Открыть QA-пресет" onChange={event => onLoadPreset(event.target.value)} className="text-sm bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded font-bold transition-colors text-purple-200 outline-none">
            <option value="">Открыть QA-пресет...</option>
            {SIMULATOR_PRESET_OPTIONS.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
          <div className="flex rounded border border-gray-700 bg-gray-900 p-1" aria-label="Режим симулятора">
            <button onClick={() => onModeChange('tier1')} className={`px-3 py-1.5 text-sm font-bold rounded ${mode === 'tier1' ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-white'}`}>T1 Баланс</button>
            <button onClick={() => onModeChange('qa')} className={`px-3 py-1.5 text-sm font-bold rounded ${mode === 'qa' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-white'}`}>QA</button>
          </div>
          <Link href="/" className="text-gray-400 hover:text-white px-4 py-2 bg-gray-800 rounded-lg">← В игру</Link>
        </div>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 mb-6 flex flex-wrap gap-6 items-center">
        {mode === 'tier1' && (
          <div>
            <label className="text-gray-400 text-sm block mb-1">Лимит командования: {commandLimit}</label>
            <input
              aria-label="Лимит командования"
              type="range"
              min={TIER1_COMMAND_RULES.minLimit}
              max={TIER1_COMMAND_RULES.maxLimit}
              value={commandLimit}
              onChange={event => onCommandLimitChange(Number(event.target.value))}
              className="w-40 accent-green-500"
            />
          </div>
        )}
        <div>
          <label className="text-gray-400 text-sm block mb-1">Seed (RNG)</label>
          <input type="text" value={seedInput} onChange={event => onSeedChange(event.target.value)} className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700 outline-none focus:border-purple-500 w-32" />
        </div>
        <div>
          <label className="text-gray-400 text-sm block mb-1">Obstacles</label>
          <button onClick={onRegenerateObstacles} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded border border-gray-700 transition-colors">
            Пересоздать кратеры
          </button>
        </div>
        <ReplayRendererSelector value={replayRendererMode} onChange={onReplayRendererChange} />
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'
import { TIER1_COMMAND_RULES, TIER1_UNIT_TYPES } from '@/domains/combat/combat.tier1.config'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import { generateObstacles } from '@/domains/combat/combat.utils'
import { UnitUpgradesPanel, SimulatorGrid } from './simulator.components'
import { LazyBattleReplayModal } from './simulator.lazy'
import type { SimulatorReplayData } from './simulator.lazy'
import { SimulatorTeamPanel } from './simulator-team-panel'
import { SimulatorToolbar } from './simulator-toolbar'
import {
  createSimulatorUnit,
  getTier1CommandPoints,
  getTier1SetupError,
  isTier1DeploymentBlocked,
  normalizeCommandLimit,
  type SimulatorMode,
} from './simulator-tier1'

export default function SimulatorPage() {
  const [seedInput, setSeedInput] = useState<string>('12345')
  const seed = Number(seedInput) || 0
  const [obstacles, setObstacles] = useState(() => generateObstacles(12345))

  function handleSeedChange(value: string) {
    setSeedInput(value)
    setObstacles(generateObstacles(Number(value) || 0))
  }

  const [attackerUnits, setAttackerUnits] = useState<UnitRow[]>([])
  const [defenderUnits, setDefenderUnits] = useState<UnitRow[]>([])
  const [replayData, setReplayData] = useState<SimulatorReplayData | null>(null)
  const [attackerGlobals, setAttackerGlobals] = useState<string[]>([])
  const [defenderGlobals, setDefenderGlobals] = useState<string[]>([])
  const [mode, setMode] = useState<SimulatorMode>('tier1')
  const [commandLimit, setCommandLimit] = useState<number>(TIER1_COMMAND_RULES.defaultLimit)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulatorError, setSimulatorError] = useState<string | null>(null), [replayRendererMode, setReplayRendererMode] = useState<'canvas' | 'pixi'>('pixi')
  const [selectedUnit, setSelectedUnit] = useState<{team: 'attacker'|'defender', index: number} | null>(null)

  function addUnit(team: 'attacker' | 'defender', type: UnitTypeKey) {
    const currentUnits = team === 'attacker' ? attackerUnits : defenderUnits
    if (mode === 'tier1' && getTier1CommandPoints(currentUnits) >= commandLimit) return
    const unit = createSimulatorUnit(team, type, currentUnits, mode, obstacles)
    if (team === 'attacker') {
      setAttackerUnits(prev => [...prev, unit])
      setSelectedUnit({ team: 'attacker', index: attackerUnits.length })
    } else {
      setDefenderUnits(prev => [...prev, unit])
      setSelectedUnit({ team: 'defender', index: defenderUnits.length })
    }
  }

  function removeUnit(team: 'attacker' | 'defender', index: number) {
    if (team === 'attacker') setAttackerUnits(prev => prev.filter((_, i) => i !== index))
    else setDefenderUnits(prev => prev.filter((_, i) => i !== index))
    if (selectedUnit?.team === team) setSelectedUnit(null)
  }

  function changeCoordinate(team: 'attacker' | 'defender', index: number, axis: 'grid_x' | 'grid_y', value: string) {
    const setUnits = team === 'attacker' ? setAttackerUnits : setDefenderUnits
    setUnits(current => current.map((unit, unitIndex) => unitIndex === index ? { ...unit, [axis]: value } : unit))
    setSimulatorError(null)
  }

  function changeMode(nextMode: SimulatorMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setAttackerUnits([])
    setDefenderUnits([])
    setAttackerGlobals([])
    setDefenderGlobals([])
    setSelectedUnit(null)
    setSimulatorError(null)
  }

  function handleCellClick(x: number, y: number) {
    const aIdx = attackerUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
    const dIdx = defenderUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)

    if (selectedUnit) {
      if (aIdx !== -1 || dIdx !== -1) return
      const selectedUnits = selectedUnit.team === 'attacker' ? attackerUnits : defenderUnits
      const candidate = { ...selectedUnits[selectedUnit.index], grid_x: String(x * 60 + 30), grid_y: String(y * 60 + 30) }
      if (mode === 'tier1' && isTier1DeploymentBlocked(candidate, obstacles)) {
        setSimulatorError('Эта позиция пересекается с препятствием.')
        return
      }
      if (selectedUnit.team === 'attacker') {
        const newU = [...attackerUnits]
        newU[selectedUnit.index] = candidate
        setAttackerUnits(newU)
      } else {
        const newU = [...defenderUnits]
        newU[selectedUnit.index] = candidate
        setDefenderUnits(newU)
      }
      setSimulatorError(null)
      setSelectedUnit(null)
    } else {
      if (aIdx !== -1) setSelectedUnit({ team: 'attacker', index: aIdx })
      else if (dIdx !== -1) setSelectedUnit({ team: 'defender', index: dIdx })
    }
  }

  async function handleSimulate() {
    const setupError = mode === 'tier1'
      ? getTier1SetupError(attackerUnits, defenderUnits, commandLimit, obstacles)
      : attackerUnits.length === 0 && defenderUnits.length === 0 ? 'Добавьте юнитов перед запуском симуляции.' : null
    if (setupError) {
      setSimulatorError(setupError)
      return
    }
    setIsSimulating(true); setSimulatorError(null)
    try {
      const { simulateBattle } = await import('@/domains/combat/combat.engine')
      const aClone = structuredClone(attackerUnits) as UnitRow[]
      const dClone = structuredClone(defenderUnits) as UnitRow[]
      const result = simulateBattle(aClone, dClone, seed, obstacles, mode === 'qa' ? attackerGlobals : [], mode === 'qa' ? defenderGlobals : [], { maxTicks: 400, timeoutPolicy: 'draw' })
      setReplayData({ attackerUnits: aClone, defenderUnits: dClone, logs: result.logs, winner: result.winner, initialState: result.initialState, obstacles: result.obstacles })
    } catch (err) {
      setSimulatorError(err instanceof Error ? err.message : 'Не удалось запустить симуляцию.')
    } finally {
      setIsSimulating(false)
    }
  }

  async function loadPreset(presetName: string) {
    if (!presetName) return
    const { getSimulatorPreset } = await import('./simulator.presets')
    const preset = getSimulatorPreset(presetName)
    if (preset) {
       setMode('qa')
       setAttackerUnits(preset.attackers)
       setDefenderUnits(preset.defenders)
       setSelectedUnit(null)
       setSimulatorError(null)
    }
  }

  const toggleAttackerGlobal = (upgId: string) => {
    setAttackerGlobals(current => current.includes(upgId) ? current.filter(id => id !== upgId) : [...current, upgId])
  }

  const toggleDefenderGlobal = (upgId: string) => {
    setDefenderGlobals(current => current.includes(upgId) ? current.filter(id => id !== upgId) : [...current, upgId])
  }

  const toggleUpgrade = (team: 'attacker'|'defender', index: number, upgId: string) => {
    const teamArray = team === 'attacker' ? attackerUnits : defenderUnits;
    const setTeamArray = team === 'attacker' ? setAttackerUnits : setDefenderUnits;
    const newArr = [...teamArray];
    const path = newArr[index].upgrade_path || [];
    newArr[index].upgrade_path = path.includes(upgId) ? path.filter(id => id !== upgId) : [...path, upgId];
    setTeamArray(newArr);
  }

  const tier1SetupError = mode === 'tier1' ? getTier1SetupError(attackerUnits, defenderUnits, commandLimit, obstacles) : null
  const canSimulate = mode === 'tier1' ? tier1SetupError === null : attackerUnits.length > 0 || defenderUnits.length > 0

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <SimulatorToolbar
          mode={mode}
          commandLimit={commandLimit}
          seedInput={seedInput}
          replayRendererMode={replayRendererMode}
          onLoadPreset={loadPreset}
          onModeChange={changeMode}
          onCommandLimitChange={value => setCommandLimit(normalizeCommandLimit(value))}
          onSeedChange={handleSeedChange}
          onRegenerateObstacles={() => setObstacles(generateObstacles(seed))}
          onReplayRendererChange={setReplayRendererMode}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-8">
            <SimulatorTeamPanel
              team="attacker"
              units={attackerUnits}
              globals={attackerGlobals}
              selectedIndex={selectedUnit?.team === 'attacker' ? selectedUnit.index : null}
              allowedUnitTypes={mode === 'tier1' ? TIER1_UNIT_TYPES : undefined}
              commandPoints={mode === 'tier1' ? getTier1CommandPoints(attackerUnits) : undefined}
              commandLimit={mode === 'tier1' ? commandLimit : undefined}
              onAddUnit={type => addUnit('attacker', type)}
              onSelectUnit={index => setSelectedUnit({ team: 'attacker', index })}
              onRemoveUnit={index => removeUnit('attacker', index)}
              onCoordinateChange={(index, axis, value) => changeCoordinate('attacker', index, axis, value)}
              onToggleGlobal={toggleAttackerGlobal}
            />

            <SimulatorTeamPanel
              team="defender"
              units={defenderUnits}
              globals={defenderGlobals}
              selectedIndex={selectedUnit?.team === 'defender' ? selectedUnit.index : null}
              allowedUnitTypes={mode === 'tier1' ? TIER1_UNIT_TYPES : undefined}
              commandPoints={mode === 'tier1' ? getTier1CommandPoints(defenderUnits) : undefined}
              commandLimit={mode === 'tier1' ? commandLimit : undefined}
              onAddUnit={type => addUnit('defender', type)}
              onSelectUnit={index => setSelectedUnit({ team: 'defender', index })}
              onRemoveUnit={index => removeUnit('defender', index)}
              onCoordinateChange={(index, axis, value) => changeCoordinate('defender', index, axis, value)}
              onToggleGlobal={toggleDefenderGlobal}
            />
            
            <button onClick={handleSimulate} disabled={isSimulating || !canSimulate} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold text-xl py-4 rounded-xl mt-4">
              {isSimulating ? 'СИМУЛЯЦИЯ...' : '⚔️ НАЧАТЬ СИМУЛЯЦИЮ'}
            </button>
            {mode === 'tier1' && tier1SetupError && (attackerUnits.length > 0 || defenderUnits.length > 0) && <p className="text-sm text-amber-300">{tier1SetupError}</p>}
            {simulatorError && <p className="text-sm text-red-300">{simulatorError}</p>}
          </div>

          <div className="shrink-0 flex flex-col items-center">
            <p className="text-sm text-gray-400 mb-2">Нажмите на юнита, затем кликните на сетку для перемещения</p>
            <SimulatorGrid 
              obstacles={obstacles} 
              attackerUnits={attackerUnits} 
              defenderUnits={defenderUnits} 
              selectedUnit={selectedUnit} 
              onCellClick={handleCellClick} 
            />
            {mode === 'qa' && selectedUnit && (
              <UnitUpgradesPanel 
                unit={selectedUnit.team === 'attacker' ? attackerUnits[selectedUnit.index] : defenderUnits[selectedUnit.index]} 
                onToggle={(upgId) => toggleUpgrade(selectedUnit.team, selectedUnit.index, upgId)} 
              />
            )}
          </div>
        </div>
      </div>

      {replayData && (
        <LazyBattleReplayModal
          attackerUnits={replayData.attackerUnits}
          defenderUnits={replayData.defenderUnits}
          initialState={replayData.initialState}
          obstacles={replayData.obstacles}
          logs={replayData.logs}
          rendererMode={replayRendererMode}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
}

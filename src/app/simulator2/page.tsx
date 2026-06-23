'use client'

import { useState, useEffect } from 'react'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { UPGRADES, GLOBAL_UPGRADES } from '@/domains/combat/combat.upgrades'
import type { UnitRow, UnitTypeKey, BattleTick } from '@/domains/combat/combat.types'
import { simulateBattle, generateObstacles } from '@/domains/combat/combat.engine'
import { getZergRushPreset } from '@/domains/combat/combat.presets'
import { UnitSelector, GlobalUpgradesSelector, UnitUpgradesPanel, SimulatorGrid } from './simulator.components'
import { BattleReplayModal } from '@/components/game/BattleReplayModal'
import Link from 'next/link'

const getRandomInt = (max: number) => Math.floor(Math.random() * max)

export default function SimulatorPage() {
  const [seed, setSeed] = useState(12345)
  const [obstacles, setObstacles] = useState<import('@/domains/combat/combat.types').Obstacle[]>([])

  useEffect(() => {
    const s = Date.now()
    setSeed(s)
    setObstacles(generateObstacles(s))
  }, [])

  const [attackerUnits, setAttackerUnits] = useState<UnitRow[]>([])
  const [defenderUnits, setDefenderUnits] = useState<UnitRow[]>([])
  const [replayData, setReplayData] = useState<{ attackerUnits: UnitRow[], defenderUnits: UnitRow[], logs: BattleTick[], winner: string, initialState: import('@/domains/combat/combat.types').SimUnit[], obstacles?: import('@/domains/combat/combat.types').Obstacle[] } | null>(null)
  
  const [attackerGlobals, setAttackerGlobals] = useState<string[]>([])
  const [defenderGlobals, setDefenderGlobals] = useState<string[]>([])

  const [selectedUnit, setSelectedUnit] = useState<{team: 'attacker'|'defender', index: number} | null>(null)

  function addUnit(team: 'attacker' | 'defender', type: UnitTypeKey) {
    const config = UNIT_TYPES[type]
    const unit: UnitRow = {
      id: crypto.randomUUID(),
      colony_id: team,
      unit_type: type,
      hp_current: config.baseStats.hp,
      tier: 1,
      upgrade_path: [],
      grid_x: String(getRandomInt(600)),
      grid_y: String(team === 'attacker' ? getRandomInt(400) + 800 : getRandomInt(400)),
    }
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
    if (selectedUnit?.team === team && selectedUnit.index === index) setSelectedUnit(null)
  }

  function handleCellClick(x: number, y: number) {
    // Is there a unit here?
    const aIdx = attackerUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
    const dIdx = defenderUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)

    if (selectedUnit) {
      // Move selected unit
      if (aIdx !== -1 || dIdx !== -1) return // Cell occupied
      if (selectedUnit.team === 'attacker') {
        const newU = [...attackerUnits]
        newU[selectedUnit.index].grid_x = String(x * 60 + 30)
        newU[selectedUnit.index].grid_y = String(y * 60 + 30)
        setAttackerUnits(newU)
      } else {
        const newU = [...defenderUnits]
        newU[selectedUnit.index].grid_x = String(x * 60 + 30)
        newU[selectedUnit.index].grid_y = String(y * 60 + 30)
        setDefenderUnits(newU)
      }
      setSelectedUnit(null)
    } else {
      // Select unit
      if (aIdx !== -1) setSelectedUnit({ team: 'attacker', index: aIdx })
      else if (dIdx !== -1) setSelectedUnit({ team: 'defender', index: dIdx })
    }
  }

  function handleSimulate() {
    if (attackerUnits.length === 0 && defenderUnits.length === 0) return alert('Добавьте юнитов!')
    const aClone = JSON.parse(JSON.stringify(attackerUnits))
    const dClone = JSON.parse(JSON.stringify(defenderUnits))
    const result = simulateBattle(aClone, dClone, seed, obstacles, attackerGlobals, defenderGlobals)
    setReplayData({ attackerUnits: aClone, defenderUnits: dClone, logs: result.logs, winner: result.winner, initialState: result.initialState, obstacles: result.obstacles })
  }

  function loadZergRushPreset() {
    const preset = getZergRushPreset()
    setAttackerUnits(preset.attackers)
    setDefenderUnits(preset.defenders)
  }

  const toggleAttackerGlobal = (upgId: string) => {
    if (attackerGlobals.includes(upgId)) setAttackerGlobals(attackerGlobals.filter(id => id !== upgId));
    else setAttackerGlobals([...attackerGlobals, upgId]);
  }

  const toggleDefenderGlobal = (upgId: string) => {
    if (defenderGlobals.includes(upgId)) setDefenderGlobals(defenderGlobals.filter(id => id !== upgId));
    else setDefenderGlobals([...defenderGlobals, upgId]);
  }

  const toggleUpgrade = (team: 'attacker'|'defender', index: number, upgId: string) => {
    const teamArray = team === 'attacker' ? attackerUnits : defenderUnits;
    const setTeamArray = team === 'attacker' ? setAttackerUnits : setDefenderUnits;
    const newArr = [...teamArray];
    const path = newArr[index].upgrade_path || [];
    if (path.includes(upgId)) {
       newArr[index].upgrade_path = path.filter(id => id !== upgId);
    } else {
       newArr[index].upgrade_path = [...path, upgId];
    }
    setTeamArray(newArr);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">🔬 Симулятор Боя (v2)</h1>
          <div className="flex gap-4">
             <button onClick={loadZergRushPreset} className="text-sm bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded font-bold transition-colors text-purple-200">
               Загрузить пресет &quot;Зерг Раш&quot;
             </button>
             <Link href="/" className="text-gray-400 hover:text-white px-4 py-2 bg-gray-800 rounded-lg">← В игру</Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Списки */}
          <div className="flex-1 flex flex-col gap-8">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-blue-900/30">
              <h2 className="text-xl font-bold text-blue-400 mb-4">Команда: Атака (Синие)</h2>
              <UnitSelector onAddUnit={(type) => addUnit('attacker', type)} />
              <GlobalUpgradesSelector globals={attackerGlobals} onToggle={toggleAttackerGlobal} />
              <div className="space-y-1 mt-4">
                {attackerUnits.map((u, i) => (
                  <div key={u.id} onClick={() => setSelectedUnit({team: 'attacker', index: i})} className={`flex justify-between items-center p-2 rounded cursor-pointer ${selectedUnit?.team === 'attacker' && selectedUnit.index === i ? 'bg-blue-900/50 border border-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                    <span>{UNIT_TYPES[u.unit_type as UnitTypeKey]?.name} [{u.grid_x}, {u.grid_y}]</span>
                    <div className="flex gap-2 items-center text-sm shrink-0" onClick={e => e.stopPropagation()}>
                      <label className="text-gray-400">X:</label>
                      <input type="number" min="0" max="600" className="w-16 bg-gray-700 rounded px-1 text-white border border-gray-600 focus:border-blue-500 outline-none" value={u.grid_x || ''} onChange={e => {
                        const newU = [...attackerUnits]; newU[i].grid_x = e.target.value; setAttackerUnits(newU)
                      }} />
                      <label className="text-gray-400">Y:</label>
                      <input type="number" min="0" max="1200" className="w-16 bg-gray-700 rounded px-1 text-white border border-gray-600 focus:border-blue-500 outline-none" value={u.grid_y || ''} onChange={e => {
                        const newU = [...attackerUnits]; newU[i].grid_y = e.target.value; setAttackerUnits(newU)
                      }} />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeUnit('attacker', i) }} className="text-red-400 hover:text-red-300 px-2 font-bold">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl border border-red-900/30">
              <h2 className="text-xl font-bold text-red-400 mb-4">Команда: Защита (Красные)</h2>
              <UnitSelector onAddUnit={(type) => addUnit('defender', type)} />
              <GlobalUpgradesSelector globals={defenderGlobals} onToggle={toggleDefenderGlobal} />
              <div className="space-y-1 mt-4">
                {defenderUnits.map((u, i) => (
                  <div key={u.id} onClick={() => setSelectedUnit({team: 'defender', index: i})} className={`flex justify-between items-center p-2 rounded cursor-pointer ${selectedUnit?.team === 'defender' && selectedUnit.index === i ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                    <span>{UNIT_TYPES[u.unit_type as UnitTypeKey]?.name} [{u.grid_x}, {u.grid_y}]</span>
                    <div className="flex gap-2 items-center text-sm shrink-0" onClick={e => e.stopPropagation()}>
                      <label className="text-gray-400">X:</label>
                      <input type="number" min="0" max="600" className="w-16 bg-gray-700 rounded px-1 text-white border border-gray-600 focus:border-red-500 outline-none" value={u.grid_x || ''} onChange={e => {
                        const newU = [...defenderUnits]; newU[i].grid_x = e.target.value; setDefenderUnits(newU)
                      }} />
                      <label className="text-gray-400">Y:</label>
                      <input type="number" min="0" max="1200" className="w-16 bg-gray-700 rounded px-1 text-white border border-gray-600 focus:border-red-500 outline-none" value={u.grid_y || ''} onChange={e => {
                        const newU = [...defenderUnits]; newU[i].grid_y = e.target.value; setDefenderUnits(newU)
                      }} />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeUnit('defender', i) }} className="text-red-400 hover:text-red-300 px-2 font-bold">×</button>
                  </div>
                ))}
              </div>
            </div>
            
            <button onClick={handleSimulate} disabled={attackerUnits.length === 0 && defenderUnits.length === 0} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold text-xl py-4 rounded-xl mt-4">
              ⚔️ НАЧАТЬ СИМУЛЯЦИЮ
            </button>
          </div>

          {/* Визуальная сетка */}
          <div className="shrink-0 flex flex-col items-center">
            <p className="text-sm text-gray-400 mb-2">Нажмите на юнита, затем кликните на сетку для перемещения</p>
            <SimulatorGrid 
              obstacles={obstacles} 
              attackerUnits={attackerUnits} 
              defenderUnits={defenderUnits} 
              selectedUnit={selectedUnit} 
              onCellClick={handleCellClick} 
            />
            {selectedUnit && (
              <UnitUpgradesPanel 
                unit={selectedUnit.team === 'attacker' ? attackerUnits[selectedUnit.index] : defenderUnits[selectedUnit.index]} 
                onToggle={(upgId) => toggleUpgrade(selectedUnit.team, selectedUnit.index, upgId)} 
              />
            )}
          </div>
        </div>
      </div>

      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits}
          defenderUnits={replayData.defenderUnits}
          initialState={replayData.initialState}
          obstacles={replayData.obstacles}
          logs={replayData.logs}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
}

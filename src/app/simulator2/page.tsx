'use client'

import { useState } from 'react'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow, UnitTypeKey, BattleTick } from '@/domains/combat/combat.types'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { BattleReplayModal } from '@/components/game/BattleReplayModal'
import Link from 'next/link'

export default function SimulatorPage() {
  const [attackerUnits, setAttackerUnits] = useState<UnitRow[]>([])
  const [defenderUnits, setDefenderUnits] = useState<UnitRow[]>([])
  const [replayData, setReplayData] = useState<{ attackerUnits: UnitRow[], defenderUnits: UnitRow[], logs: BattleTick[], winner: string, initialState: import('@/domains/combat/combat.types').SimUnit[] } | null>(null)
  
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
      grid_x: String(Math.floor(Math.random() * 600)),
      grid_y: String(team === 'attacker' ? Math.floor(Math.random() * 400) + 800 : Math.floor(Math.random() * 400)),
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
    const result = simulateBattle(aClone, dClone)
    setReplayData({ attackerUnits: aClone, defenderUnits: dClone, logs: result.logs, winner: result.winner, initialState: result.initialState })
  }

  function loadZergRushPreset() {
    const attackers: UnitRow[] = [];
    // 3 Exosuits in front
    for (let i = 0; i < 3; i++) {
       attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'exosuit', hp_current: 120, tier: 1, upgrade_path: [], grid_x: String(250 + i * 50), grid_y: '700' });
    }
    // 10 Marines
    for (let i = 0; i < 10; i++) {
       attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'marine', hp_current: 40, tier: 1, upgrade_path: [], grid_x: String(200 + (i % 5) * 50), grid_y: String(750 + Math.floor(i / 5) * 40) });
    }
    // 2 Snipers
    attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'sniper', hp_current: 30, tier: 1, upgrade_path: [], grid_x: '280', grid_y: '850' });
    attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'sniper', hp_current: 30, tier: 1, upgrade_path: [], grid_x: '320', grid_y: '850' });

    setAttackerUnits(attackers);

    const defenders: UnitRow[] = [];
    // 50 Bugs!
    for (let i = 0; i < 50; i++) {
       const jitterX = Math.random() * 400 + 100;
       const jitterY = Math.random() * 200 + 100;
       defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_bug', hp_current: 50, tier: 1, upgrade_path: [], grid_x: String(jitterX), grid_y: String(jitterY) });
    }
    // 3 Spitters
    defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '200', grid_y: '50' });
    defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '300', grid_y: '50' });
    defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '400', grid_y: '50' });

    setDefenderUnits(defenders);
  }

  const unitKeys = Object.keys(UNIT_TYPES) as UnitTypeKey[]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">🔬 Симулятор Боя (v2)</h1>
          <div className="flex gap-4">
             <button onClick={loadZergRushPreset} className="text-sm bg-purple-900 hover:bg-purple-800 px-4 py-2 rounded font-bold transition-colors text-purple-200">
               Загрузить пресет "Зерг Раш"
             </button>
             <Link href="/" className="text-gray-400 hover:text-white px-4 py-2 bg-gray-800 rounded-lg">← В игру</Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Списки */}
          <div className="flex-1 flex flex-col gap-8">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-blue-900/30">
              <h2 className="text-xl font-bold text-blue-400 mb-4">Команда: Атака (Синие)</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {unitKeys.map(key => (
                  <button key={key} onClick={() => addUnit('attacker', key)} className="bg-gray-800 hover:bg-blue-900 border border-gray-700 px-2 py-1 rounded text-sm transition-colors">+ {UNIT_TYPES[key].name}</button>
                ))}
              </div>
              <div className="space-y-1">
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
              <div className="flex flex-wrap gap-2 mb-4">
                {unitKeys.map(key => (
                  <button key={key} onClick={() => addUnit('defender', key)} className="bg-gray-800 hover:bg-red-900 border border-gray-700 px-2 py-1 rounded text-sm transition-colors">+ {UNIT_TYPES[key].name}</button>
                ))}
              </div>
              <div className="space-y-1">
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
            <div className="grid bg-gray-900 border border-gray-700 select-none shadow-[0_0_30px_rgba(0,0,0,0.5)]" style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(20, 1fr)', width: '300px', height: '600px' }}>
              {Array.from({length: 20}).map((_, y) => 
                Array.from({length: 10}).map((_, x) => {
                  const aIdx = attackerUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
                  const dIdx = defenderUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
                  
                  let bgClass = 'bg-transparent hover:bg-white/10'
                  let inner = null
                  
                  if (aIdx !== -1) {
                    const isSel = selectedUnit?.team === 'attacker' && selectedUnit.index === aIdx
                    inner = <div className={`w-full h-full rounded-full bg-blue-500 ${isSel ? 'animate-pulse shadow-[0_0_10px_#3b82f6]' : ''}`} title={UNIT_TYPES[attackerUnits[aIdx].unit_type as UnitTypeKey]?.name} />
                    bgClass = isSel ? 'bg-white/20' : 'bg-blue-900/20'
                  } else if (dIdx !== -1) {
                    const isSel = selectedUnit?.team === 'defender' && selectedUnit.index === dIdx
                    inner = <div className={`w-full h-full rounded-full bg-red-500 ${isSel ? 'animate-pulse shadow-[0_0_10px_#ef4444]' : ''}`} title={UNIT_TYPES[defenderUnits[dIdx].unit_type as UnitTypeKey]?.name} />
                    bgClass = isSel ? 'bg-white/20' : 'bg-red-900/20'
                  } else if (selectedUnit) {
                    bgClass = 'bg-transparent hover:bg-green-500/30'
                  }

                  // Разделитель зон
                  const borderClass = y === 9 ? 'border-b-2 border-b-gray-600' : 'border-b border-b-gray-800/30'

                  return (
                    <div 
                      key={`${x}-${y}`} 
                      onClick={() => handleCellClick(x, y)}
                      className={`border-r border-r-gray-800/30 ${borderClass} ${bgClass} cursor-pointer flex items-center justify-center p-[2px]`}
                    >
                      {inner}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits}
          defenderUnits={replayData.defenderUnits}
          initialState={replayData.initialState}
          logs={replayData.logs}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
}

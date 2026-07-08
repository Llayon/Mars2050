import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { UPGRADES, GLOBAL_UPGRADES } from '@/domains/combat/combat.upgrades'
import { UNIT_CATEGORIES } from '@/domains/combat/combat.presets'
import type { UnitRow, UnitTypeKey, Obstacle } from '@/domains/combat/combat.types'

export const UnitSelector = ({ onAddUnit }: { onAddUnit: (key: UnitTypeKey) => void }) => (
  <div className="flex flex-col gap-4 mb-4 max-h-[350px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-lg">
    {UNIT_CATEGORIES.map(cat => (
      <div key={cat.name}>
        <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">{cat.name}</h3>
        <div className="flex flex-wrap gap-2">
          {cat.keys.map(key => {
            const cfg = UNIT_TYPES[key];
            const statsTitle = `${cfg.name}
HP: ${cfg.baseStats.hp} | Атака: ${cfg.baseStats.attack}
Броня: ${cfg.baseStats.defense} | Скорость: ${cfg.baseStats.speed}
Тип: ${cfg.baseStats.attackType}${cfg.baseStats.isFlying ? ' | Летает' : ''}
Отряд: ${cfg.squadSize || 1} шт.`
            return (
              <button 
                key={key} 
                onClick={() => onAddUnit(key)} 
                title={statsTitle}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-2"
              >
                <span className="text-gray-300 font-medium">+ {cfg.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    ))}
  </div>
)

export const GlobalUpgradesSelector = ({ globals, onToggle }: { globals: string[], onToggle: (id: string) => void }) => {
  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
       <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Глобальные способности</h3>
       <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-lg">
         {Object.values(GLOBAL_UPGRADES).map(upg => {
           const isActive = globals.includes(upg.id);
           return (
             <div key={upg.id} onClick={() => onToggle(upg.id)} className={`p-2 rounded cursor-pointer border transition-colors ${isActive ? 'bg-indigo-900/40 border-indigo-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-bold ${isActive ? 'text-indigo-400' : 'text-gray-300'}`}>{upg.name}</span>
                  <span className="text-xs bg-gray-950 px-2 py-1 rounded text-gray-400">{upg.cost} 💰</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{upg.description}</p>
             </div>
           )
         })}
       </div>
    </div>
  )
}

export const UnitUpgradesPanel = ({ unit, onToggle }: { unit?: UnitRow, onToggle: (id: string) => void }) => {
  if (!unit) return null;

  const availableUpgrades = Object.values(UPGRADES).filter(upg => !upg.hiddenFromSimulator && (upg.allowedUnits.includes('all') || upg.allowedUnits.includes(unit.unit_type)));

  return (
    <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl w-full mt-4">
      <h3 className="font-bold text-yellow-400 mb-2">Технологии отряда: {UNIT_TYPES[unit.unit_type as UnitTypeKey]?.name}</h3>
      {availableUpgrades.length === 0 && <p className="text-gray-500 text-sm">Нет доступных технологий</p>}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-950 [&::-webkit-scrollbar-thumb]:bg-gray-700">
        {availableUpgrades.map(upg => {
          const isActive = (unit.upgrade_path || []).includes(upg.id);
          return (
            <div key={upg.id} onClick={() => onToggle(upg.id)} className={`p-2 rounded cursor-pointer border transition-colors ${isActive ? 'bg-yellow-900/30 border-yellow-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}>
               <div className="flex justify-between items-center">
                 <span className={`font-bold ${isActive ? 'text-yellow-400' : 'text-gray-300'}`}>{upg.name}</span>
                 <span className="text-xs bg-gray-950 px-2 py-1 rounded text-gray-400">{upg.cost} 💰</span>
               </div>
               <p className="text-xs text-gray-400 mt-1">{upg.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const SimulatorGrid = ({
  obstacles, attackerUnits, defenderUnits, selectedUnit, onCellClick
}: {
  obstacles?: Obstacle[],
  attackerUnits: UnitRow[],
  defenderUnits: UnitRow[],
  selectedUnit: { team: 'attacker'|'defender', index: number } | null,
  onCellClick: (x: number, y: number) => void
}) => {
  return (
    <div className="grid bg-gray-900 border border-gray-700 select-none shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden" style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(20, 1fr)', width: '300px', height: '600px' }}>
      {obstacles?.map((obs, i) => (
        <img 
          key={`obs-${i}`}
          src="/sprites/crater.svg"
          className="absolute"
          style={{
            left: `${obs.x * 0.5 - obs.radius * 0.5}px`,
            top: `${obs.y * 0.5 - obs.radius * 0.5}px`,
            width: `${obs.radius}px`,
            height: `${obs.radius}px`,
            pointerEvents: 'none'
          }}
          title="Кратер (Препятствие)"
          alt="crater"
        />
      ))}

      {Array.from({length: 20}).map((_, y) => 
        Array.from({length: 10}).map((_, x) => {
          const aIdx = attackerUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
          const dIdx = defenderUnits.findIndex(u => Math.floor(Number(u.grid_x)/60) === x && Math.floor(Number(u.grid_y)/60) === y)
          
          let bgClass = 'bg-transparent hover:bg-white/10 z-10 relative'
          let inner = null
          
          if (aIdx !== -1) {
            const isSel = selectedUnit?.team === 'attacker' && selectedUnit.index === aIdx
            inner = <div className={`w-full h-full rounded-full bg-blue-500 ${isSel ? 'animate-pulse shadow-[0_0_10px_#3b82f6]' : ''}`} title={UNIT_TYPES[attackerUnits[aIdx].unit_type as UnitTypeKey]?.name} />
            bgClass = isSel ? 'bg-white/20 z-10 relative' : 'bg-blue-900/20 z-10 relative'
          } else if (dIdx !== -1) {
            const isSel = selectedUnit?.team === 'defender' && selectedUnit.index === dIdx
            inner = <div className={`w-full h-full rounded-full bg-red-500 ${isSel ? 'animate-pulse shadow-[0_0_10px_#ef4444]' : ''}`} title={UNIT_TYPES[defenderUnits[dIdx].unit_type as UnitTypeKey]?.name} />
            bgClass = isSel ? 'bg-white/20 z-10 relative' : 'bg-red-900/20 z-10 relative'
          } else if (selectedUnit) {
            bgClass = 'bg-transparent hover:bg-green-500/30 z-10 relative'
          }

          const borderClass = y === 9 ? 'border-b-2 border-b-gray-600' : 'border-b border-b-gray-800/30'

          return (
            <div 
              key={`${x}-${y}`} 
              onClick={() => onCellClick(x, y)}
              className={`border-r border-r-gray-800/30 ${borderClass} ${bgClass} cursor-pointer flex items-center justify-center p-[2px]`}
            >
              {inner}
            </div>
          )
        })
      )}
    </div>
  )
}

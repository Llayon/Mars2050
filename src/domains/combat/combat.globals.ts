import type { BattleAction } from './combat.actions';
import type { SimUnit, SimHazard, Team } from './combat.sim.types';
import { PRNG, FIELD_WIDTH, FIELD_HEIGHT } from './combat.utils';
import { GlobalUpgradeConfig } from './combat.upgrades';
import { applyStatus } from './combat.status';
import { applyHealing } from './combat.healing';

export function processGlobals(
  tick: number,
  activeGlobals: { team: Team; upg: GlobalUpgradeConfig }[],
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG
) {
  // Process Instant Globals at tick 0
  if (tick === 0) {
     activeGlobals.forEach(({ team, upg }) => {
        if (upg.type === 'mass_shield') {
           const targets = units.filter(u => !u.isDead && u.team === team)
           targets.forEach(t => {
              t.maxShield += upg.value;
              t.shield += upg.value;
           })
        }
     })
  }
  
  // Process Timed Globals
  activeGlobals.forEach(({ team, upg }) => {
     const triggerTick = upg.type === 'global_emp' ? 50 : (upg.type === 'orbital_strike' ? 100 : (upg.type === 'mass_heal' ? 150 : -1))
     if (tick === triggerTick) {
        const enemyTeam = team === 'attacker' ? 'defender' : 'attacker'
        
        if (upg.type === 'orbital_strike') {
           let bestCx = FIELD_WIDTH / 2, bestCy = FIELD_HEIGHT / 2;
           const enemies = units.filter(u => !u.isDead && u.team === enemyTeam);
           if (enemies.length > 0) {
              let cx = 0, cy = 0;
              enemies.forEach(e => { cx += e.x; cy += e.y; })
              bestCx = cx / enemies.length;
              bestCy = cy / enemies.length;
           }
           
           hazards.push({
              id: 'orb_strike_' + Math.floor(rng.next() * 1000000),
              team,
              type: 'napalm',
              x: bestCx,
              y: bestCy,
              radius: 200,
              duration: 5,
              damagePerTick: upg.value
           })
           actions.push({ unitId: 'system', type: 'hazard_spawn', toX: bestCx, toY: bestCy, radius: 200 })
           
        } else if (upg.type === 'global_emp') {
           const enemies = units.filter(u => !u.isDead && u.team === enemyTeam)
           enemies.forEach(e => {
              applyStatus(e, { type: 'emp', duration: upg.value, sourceUnitId: 'global_emp' }, actions)
           })
        } else if (upg.type === 'mass_heal') {
           const allies = units.filter(u => !u.isDead && u.team === team)
           allies.forEach(a => {
              applyHealing('system', a, upg.value, actions)
           })
        }
     }
  })
}

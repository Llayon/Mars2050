import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import { getDistance } from './combat.utils';

export function processHazards(hazards: SimHazard[], units: SimUnit[], actions: BattleAction[]) {
  for (let i = hazards.length - 1; i >= 0; i--) {
     const h = hazards[i];
     h.duration--;
     if (h.duration <= 0) {
        hazards.splice(i, 1);
        continue;
     }
     
     // Every 10 ticks (approx 1 sec), apply damage
     if (h.duration % 10 === 0) {
        const targets = units.filter(u => !u.isDead && !u.isFlying && getDistance(u.x, u.y, h.x, h.y) <= h.radius);
        for (const t of targets) {
           t.hp -= h.damagePerTick;
           actions.push({ unitId: h.id, type: 'attack', targetId: t.id, damage: h.damagePerTick });
           if (t.hp <= 0 && !t.isDead) {
             t.isDead = true;
             actions.push({ unitId: t.id, type: 'die' });
           }
        }
     }
  }
}

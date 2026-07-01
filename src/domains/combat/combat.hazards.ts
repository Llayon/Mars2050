import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import { applyStatus } from './combat.status';
import { getDistance } from './combat.utils';

export function processHazards(hazards: SimHazard[], units: SimUnit[], actions: BattleAction[]) {
  for (let i = hazards.length - 1; i >= 0; i--) {
     const h = hazards[i];
     h.duration--;
     if (h.duration <= 0) {
        hazards.splice(i, 1);
        continue;
     }

     if (h.type === 'mine') {
        if (processMine(h, units, actions)) hazards.splice(i, 1);
        continue;
     }
     if (h.type === 'smoke') {
        processSmoke(h, units, actions);
        continue;
     }
     
     // Every 10 ticks (approx 1 sec), apply damage
     if (h.duration % 10 === 0) {
        const targets = units.filter(u => !u.isDead && !u.isFlying && getDistance(u.x, u.y, h.x, h.y) <= h.radius);
        for (const t of targets) {
           t.hp -= h.damagePerTick;
           actions.push({ unitId: h.id, type: 'damage', targetId: t.id, damage: h.damagePerTick });
           if (t.hp <= 0 && !t.isDead) {
             t.isDead = true;
             actions.push({ unitId: t.id, type: 'die' });
           }
        }
     }
  }
}

function processSmoke(h: SimHazard, units: SimUnit[], actions: BattleAction[]): void {
  if (h.duration % 10 !== 0) return;
  const effects = h.statusEffects ?? [];
  if (effects.length === 0) return;

  const targets = units
    .filter(u => !u.isDead && !u.isFlying && getDistance(u.x, u.y, h.x, h.y) <= h.radius)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const target of targets) {
    for (const effect of effects) {
      applyStatus(target, { ...effect, sourceUnitId: h.id, stackKey: h.id }, actions);
    }
  }
}

function processMine(h: SimHazard, units: SimUnit[], actions: BattleAction[]): boolean {
  const targets = units
    .filter(u => !u.isDead && !u.isFlying && u.team !== h.team && getDistance(u.x, u.y, h.x, h.y) <= h.radius)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (targets.length === 0) return false;

  for (const target of targets) {
    target.hp -= h.damagePerTick;
    actions.push({ unitId: h.id, type: 'damage', targetId: target.id, damage: h.damagePerTick });
    if (target.hp <= 0 && !target.isDead) {
      target.isDead = true;
      actions.push({ unitId: target.id, type: 'die' });
    }
  }

  return true;
}

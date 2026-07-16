import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import { applyStatus } from './combat.status';
import { getDistance } from './combat.utils';
import type { DeathCause } from './combat.death';
import type { SpatialHash } from './spatial-hash';

export function processHazards(hazards: SimHazard[], units: SimUnit[], actions: BattleAction[], onUnitDeath?: (unit: SimUnit, sourceUnitId: string | undefined, cause: DeathCause) => void, spatialHash?: SpatialHash) {
  for (let i = hazards.length - 1; i >= 0; i--) {
     const h = hazards[i];
     h.duration--;
     if (h.duration <= 0) {
        if (h.type === 'barrier_dome' && h.capacity !== undefined && h.capacity > 0) actions.push({ unitId: h.sourceUnitId ?? h.id, type: 'barrier_expire', hazardId: h.id });
        hazards.splice(i, 1);
        continue;
     }

     if (h.type === 'mine') {
        if (processMine(h, localUnits(h, units, spatialHash), actions, onUnitDeath)) hazards.splice(i, 1);
        continue;
     }
     if (h.type === 'smoke') {
        processSmoke(h, localUnits(h, units, spatialHash), actions);
        continue;
     }
     
     // Every 10 ticks (approx 1 sec), apply damage
     if (h.damagePerTick > 0 && h.duration % 10 === 0) {
        const targets = localUnits(h, units, spatialHash).filter(u => !u.isDead && !u.isFlying && getDistance(u.x, u.y, h.x, h.y) <= h.radius);
        for (const t of targets) {
           t.hp -= h.damagePerTick;
           actions.push(createHazardDamageAction(h, t));
           if (t.hp <= 0 && !t.isDead) {
             onUnitDeath?.(t, h.sourceUnitId, 'hazard');
           }
        }
     }
  }
}

function localUnits(hazard: SimHazard, units: SimUnit[], spatialHash?: SpatialHash): SimUnit[] {
  return spatialHash?.query(hazard.x, hazard.y, hazard.radius) ?? units
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

function processMine(h: SimHazard, units: SimUnit[], actions: BattleAction[], onUnitDeath?: (unit: SimUnit, sourceUnitId: string | undefined, cause: DeathCause) => void): boolean {
  const targets = units
    .filter(u => !u.isDead && !u.isFlying && u.team !== h.team && getDistance(u.x, u.y, h.x, h.y) <= h.radius)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (targets.length === 0) return false;

  for (const target of targets) {
    target.hp -= h.damagePerTick;
    actions.push(createHazardDamageAction(h, target));
    if (target.hp <= 0 && !target.isDead) {
      onUnitDeath?.(target, h.sourceUnitId, 'mine');
    }
  }

  return true;
}

function createHazardDamageAction(hazard: SimHazard, target: SimUnit): BattleAction {
  const action: BattleAction = { unitId: hazard.sourceUnitId ?? hazard.id, type: 'damage', targetId: target.id, damage: hazard.damagePerTick, hazardId: hazard.id, damageKind: 'hazard' }
  if (hazard.sourceUnitId) action.sourceUnitId = hazard.sourceUnitId
  return action
}

import { SimUnit } from './combat.types';
import { getDistance, getSizeRadius } from './combat.utils';

export function targetingSystem(unit: SimUnit, units: SimUnit[], meleeTargetCounts: Record<string, number>): SimUnit | null {
  let target: SimUnit | null = null;
  let minDistance = Infinity;

  if (unit.attackType === 'heal') {
    let allies = units.filter(a => !a.isDead && a.team === unit.team && a.hp < a.maxHp && a.id !== unit.id);
    if (allies.length === 0) {
      allies = units.filter(a => !a.isDead && a.team === unit.team && a.id !== unit.id);
    }
    if (allies.length > 0) {
       for (const ally of allies) {
         const dist = getDistance(unit.x, unit.y, ally.x, ally.y);
         if (dist < minDistance) { minDistance = dist; target = ally; }
       }
    }
  } else {
    const enemies = units.filter(e => !e.isDead && e.team !== unit.team && (!e.isFlying || unit.canTargetAir) && !(e.stealthUntilAttack && !e.hasAttacked));
    if (enemies.length === 0) return null;
    
    // Filter out enemies that are already fully surrounded (if this is a melee unit)
    let validEnemies = enemies;
    if (unit.range <= 60) {
       validEnemies = enemies.filter(e => {
          const slotsTaken = meleeTargetCounts[e.id] || 0;
          const targetRadius = getSizeRadius(e.size);
          const myRadius = getSizeRadius(unit.size);
          const circumference = 2 * Math.PI * (targetRadius + myRadius);
          const maxSlots = Math.floor(circumference / (myRadius * 2));
          return slotsTaken < maxSlots;
       });
       
       // Fallback: if all enemies are perfectly surrounded, just walk towards the closest one anyway
       if (validEnemies.length === 0) validEnemies = enemies;
    }

    for (const enemy of validEnemies) {
      const dist = getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minDistance) {
        minDistance = dist;
        target = enemy;
      } else if (dist === minDistance && target && enemy.hp < target.hp) {
        target = enemy;
      }
    }
  }
  return target;
}

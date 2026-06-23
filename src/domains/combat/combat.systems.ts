import { SimUnit, BattleAction, SimHazard, UnitTypeKey } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, getSizeRadius } from './combat.utils';

// --- ECS Systems ---


export function tickModifiersSystem(unit: SimUnit, dt: number, actions: BattleAction[]) {
  if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - 1);

  if (unit.statusEffects) {
    for (let i = unit.statusEffects.length - 1; i >= 0; i--) {
      const eff = unit.statusEffects[i];
      eff.duration--;
      if (eff.duration <= 0) {
        unit.statusEffects.splice(i, 1);
        actions.push({ unitId: unit.id, type: 'status_expire', statusType: eff.type });
      }
    }
  }
}

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
    const enemies = units.filter(e => !e.isDead && e.team !== unit.team && (!e.isFlying || unit.canTargetAir));
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

export function actionSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], hazards: SimHazard[], actions: BattleAction[], rng: PRNG): boolean {
  const dist = getDistance(unit.x, unit.y, target.x, target.y);
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const distEdge = dist - targetRadius - myRadius;
  
  const inRange = unit.attackType === 'spawn' || (unit.attackType !== 'heal' && distEdge <= unit.range) || 
                 (unit.attackType === 'heal' && target.hp < target.maxHp && distEdge <= unit.range);

  if (!inRange) return false;

  // Check if facing target
  const targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
  let angleDiff = targetAngle - unit.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  
  // If angle difference is greater than 15 degrees (~0.26 radians), need to rotate first
  if (Math.abs(angleDiff) > 0.26) return false;

  if (unit.actionCooldown > 0) return false;

  unit.actionCooldown = unit.actionCooldownMax; // Reset cooldown

  if (unit.attackType === 'spawn') {
     // Spawn a turret directly in front of the engineer (towards target)
     const dx = target.x - unit.x;
     const dy = target.y - unit.y;
     const mag = Math.hypot(dx, dy) || 1;
     let spawnX = unit.x + (dx / mag) * 40; // spawn 40 units ahead
     let spawnY = unit.y + (dy / mag) * 40;
     
     // Check if spawn position is out of bounds
     if (spawnX < 0 || spawnX >= FIELD_WIDTH || spawnY < 0 || spawnY >= FIELD_HEIGHT) {
        spawnX = unit.x; // Fallback to current position
        spawnY = unit.y;
     }

     const spawnType = unit.spawnType || 'turret';
     const newId = 'spawn_' + Math.floor(rng.next() * 1000000);
     const spawnConfig = UNIT_TYPES[spawnType as UnitTypeKey];
     
     units.push({
       id: newId,
       team: unit.team,
       type: spawnType,
       hp: spawnConfig.baseStats.hp,
       maxHp: spawnConfig.baseStats.hp,
       attack: spawnConfig.baseStats.attack,
       defense: spawnConfig.baseStats.defense,
       speed: spawnConfig.baseStats.speed,
       range: spawnConfig.baseStats.range,
       attackType: spawnConfig.baseStats.attackType || 'single',
       aoeRadius: spawnConfig.baseStats.aoeRadius,
       actionCooldownMax: spawnConfig.baseStats.actionCooldownMax || 5,
       actionCooldown: 0,
       isFlying: spawnConfig.baseStats.isFlying || false,
       canTargetAir: spawnConfig.baseStats.canTargetAir || false,
       turnSpeed: spawnConfig.baseStats.turnSpeed || 5,
       currentAngle: unit.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
       size: spawnConfig.baseStats.size || 'M',
       x: spawnX,
       y: spawnY,
       isDead: false,
       shield: 0,
       maxShield: 0,
       statusEffects: []
     });

     actions.push({ 
       unitId: unit.id, 
       type: 'spawn', 
       toX: spawnX, 
       toY: spawnY, 
       spawnType: spawnType, 
       spawnTeam: unit.team, 
       spawnMaxHp: spawnConfig.baseStats.hp,
       targetId: newId
     });
     return true;
  }

  if (unit.attackType === 'heal') {

     const healAmount = unit.attack;
     target.hp = Math.min(target.maxHp, target.hp + healAmount);
     actions.push({ unitId: unit.id, type: 'heal', targetId: target.id, damage: healAmount });
  } else {
     const damage = Math.max(1, unit.attack - target.defense);
     target.hp -= damage;
     actions.push({ unitId: unit.id, type: 'attack', targetId: target.id, damage });

     if (target.hp <= 0 && !target.isDead) {
       target.isDead = true;
       actions.push({ unitId: target.id, type: 'die' });
     }

     if (unit.attackType === 'aoe' && unit.aoeRadius) {
       const radius = unit.aoeRadius;
       const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target.id);
       for (const e of splashEnemies) {
          if (getDistance(target.x, target.y, e.x, e.y) <= radius) {
             const splash = Math.max(1, Math.floor(unit.attack * 0.5) - e.defense);
             e.hp -= splash;
             actions.push({ unitId: unit.id, type: 'attack', targetId: e.id, damage: splash });
             if (e.hp <= 0 && !e.isDead) {
               e.isDead = true;
               actions.push({ unitId: e.id, type: 'die' });
             }
          }
       }
     }
  }
  return true;
}


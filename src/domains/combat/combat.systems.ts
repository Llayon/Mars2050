import { SimUnit, BattleAction } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { getDistance } from './combat.utils';
import { FIELD_WIDTH, FIELD_HEIGHT, PRNG } from './combat.utils';

// --- ECS Systems ---


export function tickModifiersSystem(unit: SimUnit, dt: number) {
  if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - 1);
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
          let maxSlots = 6;
          if (e.maxHp >= 100) maxSlots = 10;
          if (e.type === 'wall') maxSlots = 20;
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

export function actionSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], rng: PRNG): boolean {
  const dist = getDistance(unit.x, unit.y, target.x, target.y);
  const inRange = (unit.attackType !== 'heal' && dist <= unit.range) || 
                 (unit.attackType === 'heal' && target.hp < target.maxHp && dist <= unit.range);

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
     let dx = target.x - unit.x;
     let dy = target.y - unit.y;
     const mag = Math.hypot(dx, dy) || 1;
     let spawnX = unit.x + (dx / mag) * 40; // spawn 40 units ahead
     let spawnY = unit.y + (dy / mag) * 40;
     
     // Check if spawn position is out of bounds
     if (spawnX < 0 || spawnX >= FIELD_WIDTH || spawnY < 0 || spawnY >= FIELD_HEIGHT) {
        spawnX = unit.x; // Fallback to current position
        spawnY = unit.y;
     }

     const newId = 'spawn_' + Math.floor(rng.next() * 1000000);
     const turretConfig = UNIT_TYPES['turret'];
     
     units.push({
       id: newId,
       team: unit.team,
       type: 'turret',
       hp: turretConfig.baseStats.hp,
       maxHp: turretConfig.baseStats.hp,
       attack: turretConfig.baseStats.attack,
       defense: turretConfig.baseStats.defense,
       speed: turretConfig.baseStats.speed,
       range: turretConfig.baseStats.range,
       attackType: turretConfig.baseStats.attackType || 'single',
       aoeRadius: turretConfig.baseStats.aoeRadius,
       actionCooldownMax: turretConfig.baseStats.actionCooldownMax || 5,
       actionCooldown: 0,
       isFlying: turretConfig.baseStats.isFlying || false,
       canTargetAir: turretConfig.baseStats.canTargetAir || false,
       x: spawnX,
       y: spawnY,
       isDead: false
     });

     actions.push({ 
       unitId: unit.id, 
       type: 'spawn', 
       toX: spawnX, 
       toY: spawnY, 
       spawnType: 'turret', 
       spawnTeam: unit.team, 
       spawnMaxHp: turretConfig.baseStats.hp,
       targetId: newId
     });
     return true;
  }

  if (unit.attackType === 'heal') {

     const healAmount = unit.attack;
     target.hp = Math.min(target.maxHp, target.hp + healAmount);
     actions.push({ unitId: unit.id, type: 'heal', targetId: target.id, damage: healAmount });
  } else {
     let damage = Math.max(1, unit.attack - target.defense);
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

export function movementSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], dt: number, rng: PRNG) {
  if (unit.speed <= 0) return;
  
  let vx = 0;
  let vy = 0;
  
  const distToTarget = getDistance(unit.x, unit.y, target.x, target.y);
  const isInRange = distToTarget <= unit.range;

  // Turn logic (Angular Velocity)
  let targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
  
  let angleDiff = targetAngle - unit.currentAngle;
  
  // Normalize to -PI to PI
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const maxTurn = unit.turnSpeed * dt;
  if (Math.abs(angleDiff) <= maxTurn) {
      unit.currentAngle = targetAngle;
  } else {
      unit.currentAngle += Math.sign(angleDiff) * maxTurn;
  }
  
  // Normalize currentAngle just in case
  while (unit.currentAngle > Math.PI) unit.currentAngle -= Math.PI * 2;
  while (unit.currentAngle < -Math.PI) unit.currentAngle += Math.PI * 2;

  // Only move towards target if outside of attack range, otherwise base velocity is 0 (stand and fight)
  // Heal targets use the same range logic
  if (!isInRange) {
    // MOVE ALONG CURRENT ANGLE, NOT TARGET ANGLE! (This causes heavy units to move in arcs)
    vx = Math.cos(unit.currentAngle) * unit.speed;
    vy = Math.sin(unit.currentAngle) * unit.speed;
  }

  // Soft collision (Boids separation) and Cohesion (Squad Physics)
  const UNIT_RADIUS = 18;
  let squadCx = 0, squadCy = 0, squadCount = 0;

  for (const other of units) {
    if (other.isDead || other.id === unit.id) continue;
    
    // Cohesion: find center of mass of the squad
    if (unit.squadId && other.squadId === unit.squadId) {
      squadCx += other.x;
      squadCy += other.y;
      squadCount++;
    }

    if (unit.isFlying !== other.isFlying) continue;
    
    const dist = getDistance(unit.x, unit.y, other.x, other.y);
    const minDist = UNIT_RADIUS * 2;
    if (dist > 0 && dist < minDist) {
       const overlap = minDist - dist;
       const pushAngle = Math.atan2(unit.y - other.y, unit.x - other.x);
       
       // Mass calculation: heavier units (more maxHp) get pushed less, lighter units get pushed more
       const myMass = unit.maxHp || 20;
       const otherMass = other.maxHp || 20;
       const totalMass = myMass + otherMass;
       
       // Mass ratio
       const pushRatio = (otherMass / totalMass) * 2; 
       
       // Stance Stability (Friction): If a unit is in range and attacking, it "plants its feet"
       // and heavily resists being pushed back (acts as a wall).
       const stanceMultiplier = isInRange ? 0.3 : 1.0;
       
       const pushForce = overlap * 5 * pushRatio * stanceMultiplier; 
       vx += Math.cos(pushAngle) * pushForce;
       vy += Math.sin(pushAngle) * pushForce;
    }
  }

  // Apply Cohesion Force (Squads stick together)
  if (squadCount > 0) {
    squadCx /= squadCount;
    squadCy /= squadCount;
    const cohDist = getDistance(unit.x, unit.y, squadCx, squadCy);
    if (cohDist > 60) {
      const cohAngle = Math.atan2(squadCy - unit.y, squadCx - unit.x);
      // Cohesion should not pull a planted unit out of combat
      const pullForce = unit.speed * (isInRange ? 0.1 : 0.5); 
      vx += Math.cos(cohAngle) * pullForce;
      vy += Math.sin(cohAngle) * pullForce;
    }
  }

  // Cap velocity to avoid them flying off screen if they are perfectly stacked
  // If unit is planted (fighting), it shouldn't slide backwards fast
  const maxSpeed = unit.speed * (isInRange ? 0.4 : 1.5);
  const finalMag = Math.hypot(vx, vy);
  if (finalMag > maxSpeed) {
      vx = (vx / finalMag) * maxSpeed;
      vy = (vy / finalMag) * maxSpeed;
  }

  let nx = unit.x + vx * dt;
  let ny = unit.y + vy * dt;

  // Keep in bounds
  nx = Math.max(0, Math.min(FIELD_WIDTH, nx));
  ny = Math.max(0, Math.min(FIELD_HEIGHT, ny));

  if (nx !== unit.x || ny !== unit.y || Math.abs(angleDiff) > 0.05) { // Even if not moving, we might be turning!
    const fromX = unit.x, fromY = unit.y;
    unit.x = nx; unit.y = ny;
    // Round to 2 decimal places to save JSON size but keep movement smooth
    const r = (v: number) => Math.round(v * 100) / 100;
    actions.push({ 
       unitId: unit.id, 
       type: 'move', 
       targetId: target.id, 
       fromX: r(fromX), 
       fromY: r(fromY), 
       toX: r(nx), 
       toY: r(ny),
       facingAngle: r(unit.currentAngle)
    });
  }
}

// --- End ECS Systems ---

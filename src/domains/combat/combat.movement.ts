import { SimUnit, BattleAction } from './combat.types';
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, getSizeRadius, getSizeMass } from './combat.utils';
import { FlowFieldMap, getFlowVector } from './combat.pathfinding';
import { Obstacle } from './combat.types';

export function movementSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], dt: number, rng: PRNG, flowFieldMap: FlowFieldMap, obstacles: Obstacle[]) {
  if (unit.speed <= 0) return;
  
  let vx = 0;
  let vy = 0;
  
  const distToTarget = getDistance(unit.x, unit.y, target.x, target.y);
  // Subtracting sizes so that melee units stop at the edge of the target, not center
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const isInRange = (distToTarget - targetRadius - myRadius) <= unit.range;

  // Turn logic (Angular Velocity)
  let targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
  
  // Use Flow Field if not flying and relatively far from target to avoid obstacles
  if (!unit.isFlying && distToTarget > 60) {
      const flowAngle = getFlowVector(flowFieldMap, unit.x, unit.y, target.x, target.y);
      if (flowAngle !== null) {
          targetAngle = flowAngle;
      }
  }
  
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

  // Soft collision (Boids separation), Cohesion and Alignment
  const isBug = unit.type.startsWith('alien_');
  let squadCx = 0, squadCy = 0, squadCount = 0;
  let squadVx = 0, squadVy = 0;
  let alignVx = 0, alignVy = 0, alignCount = 0;

  for (const other of units) {
    if (other.isDead || other.id === unit.id) continue;
    
    // Cohesion: find center of mass of the squad
    if (unit.squadId && other.squadId === unit.squadId) {
      squadCx += other.x;
      squadCy += other.y;
      squadVx += Math.cos(other.currentAngle);
      squadVy += Math.sin(other.currentAngle);
      squadCount++;
    }

    if (unit.isFlying !== other.isFlying) continue;
    
    const dist = getDistance(unit.x, unit.y, other.x, other.y);
    const otherRadius = getSizeRadius(other.size);
    const minDist = myRadius + otherRadius;

    // Alignment (Boids): Bugs align their movement with nearby bugs
    if (isBug && other.type.startsWith('alien_') && dist < 80) {
      alignVx += Math.cos(other.currentAngle);
      alignVy += Math.sin(other.currentAngle);
      alignCount++;
    }

    if (dist > 0 && dist < minDist) {
       const overlap = minDist - dist;
       const pushAngle = Math.atan2(unit.y - other.y, unit.x - other.x);
       
       const myMass = getSizeMass(unit.size);
       const otherMass = getSizeMass(other.size);
       const pushRatio = (otherMass / (myMass + otherMass)) * 2; 
       
       const stanceMultiplier = isInRange ? 0.5 : 1.0; // Pushes less but still resolves overlap when fighting
       const pushForce = overlap * 5 * pushRatio * stanceMultiplier; 
       vx += Math.cos(pushAngle) * pushForce;
       vy += Math.sin(pushAngle) * pushForce;
    }
  }

  // Soft collision with obstacles
  if (!unit.isFlying) {
     for (const obs of obstacles) {
        const dist = getDistance(unit.x, unit.y, obs.x, obs.y);
        const minDist = myRadius + obs.radius;
        if (dist > 0 && dist < minDist) {
           const overlap = minDist - dist;
           const pushAngle = Math.atan2(unit.y - obs.y, unit.x - obs.x);
           const pushForce = overlap * 15; // strong push away from obstacles
           vx += Math.cos(pushAngle) * pushForce;
           vy += Math.sin(pushAngle) * pushForce;
        }
     }
  }

  // Apply Boids Alignment Force (Bugs swarm together)
  if (isBug && alignCount > 0) {
    const avgAlignAngle = Math.atan2(alignVy, alignVx);
    const alignForce = unit.speed * (isInRange ? 0 : 0.4);
    vx += Math.cos(avgAlignAngle) * alignForce;
    vy += Math.sin(avgAlignAngle) * alignForce;
  }

  // Apply Cohesion Force (Formations)
  if (squadCount > 0) {
    squadCx /= squadCount;
    squadCy /= squadCount;
    
    let targetCx = squadCx;
    let targetCy = squadCy;
    
    if (!isBug && unit.offsetX !== undefined && unit.offsetY !== undefined && unit.initialAngle !== undefined) {
      // Humans keep strict military formation relative to squad center
      // Rotate the local offset to match the squad's average heading
      const squadAngle = Math.atan2(squadVy, squadVx);
      const rotation = squadAngle - unit.initialAngle;
      
      const rotatedOx = unit.offsetX * Math.cos(rotation) - unit.offsetY * Math.sin(rotation);
      const rotatedOy = unit.offsetX * Math.sin(rotation) + unit.offsetY * Math.cos(rotation);
      
      targetCx += rotatedOx;
      targetCy += rotatedOy;
    }

    const cohDist = getDistance(unit.x, unit.y, targetCx, targetCy);
    const cohThreshold = isBug ? 60 : 10; // Bugs are loose, Humans are strict
    
    if (cohDist > cohThreshold) {
      const cohAngle = Math.atan2(targetCy - unit.y, targetCx - unit.x);
      const pullForce = unit.speed * (isInRange ? 0 : (isBug ? 0.5 : 0.8)); 
      vx += Math.cos(cohAngle) * pullForce;
      vy += Math.sin(cohAngle) * pullForce;
    }
  }

  // Cap velocity to avoid them flying off screen if they are perfectly stacked
  // If unit is planted (fighting), it shouldn't slide backwards fast
  const maxSpeed = unit.speed * (isInRange ? 0.4 : 1.5);
  const finalMag = Math.hypot(vx, vy);
  
  if (finalMag < 0.5) {
     vx = 0;
     vy = 0;
  } else if (finalMag > maxSpeed) {
      vx = (vx / finalMag) * maxSpeed;
      vy = (vy / finalMag) * maxSpeed;
  }

  let nx = unit.x + vx * dt;
  let ny = unit.y + vy * dt;

  // Keep in bounds
  nx = Math.max(0, Math.min(FIELD_WIDTH, nx));
  ny = Math.max(0, Math.min(FIELD_HEIGHT, ny));

  if (Math.hypot(nx - unit.x, ny - unit.y) > 0.1 || Math.abs(angleDiff) > 0.2) { // Only emit move if significantly moved or turned
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

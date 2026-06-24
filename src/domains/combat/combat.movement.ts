import type { BattleAction } from './combat.actions';
import type { Obstacle, SimUnit } from './combat.sim.types';
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, getSizeRadius } from './combat.utils';
import { FlowFieldMap, getFlowVector } from './combat.pathfinding';
import type { SpatialHash } from './spatial-hash';
import { getMovementNeighbors, getSteeringContext } from './combat.steering';
import { getStuckRecoveryForce, updateStuckRecovery } from './combat.stuck-recovery';
import { getMeleeEngagementPoint } from './combat.melee-engagement';

const MELEE_SLOT_FORMATION_RELEASE_DISTANCE = 140;

export function movementSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], dt: number, rng: PRNG, flowFieldMap: FlowFieldMap, obstacles: Obstacle[], spatialHash?: SpatialHash) {
  if (unit.speed <= 0) return;
  
  let vx = 0;
  let vy = 0;
  
  if (!unit.velocity) unit.velocity = { x: 0, y: 0 };

  const neighbors = getMovementNeighbors(unit, units, spatialHash);
  const isBug = unit.type.startsWith('alien_');

  const distToTarget = getDistance(unit.x, unit.y, target.x, target.y);
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const isInRange = (distToTarget - targetRadius - myRadius) <= unit.range;
  const engagementPoint = getMeleeEngagementPoint(unit, target);
  const useSlotApproach = engagementPoint !== null && !isInRange;
  const approachX = useSlotApproach ? engagementPoint.x : target.x;
  const approachY = useSlotApproach ? engagementPoint.y : target.y;
  updateStuckRecovery(unit, target, distToTarget, isInRange);
  const steering = getSteeringContext(unit, neighbors, myRadius, isInRange);
  const { squadCx, squadCy, squadCount } = steering;

  // Turn logic: if in a squad, aim parallel to the squad's direction to the target to prevent converging and crushing
  let targetAngle = (unit.squadId && squadCount > 1 && !useSlotApproach && distToTarget > unit.range * 1.5)
      ? Math.atan2(target.y - squadCy, target.x - squadCx)
      : Math.atan2(approachY - unit.y, approachX - unit.x);
  
  let isNavigatingObstacle = false;

  // Use Flow Field if not flying to avoid obstacles
  if (!unit.isFlying && distToTarget > unit.range) {
      const flowAngle = getFlowVector(flowFieldMap, unit.x, unit.y, approachX, approachY);
      if (flowAngle !== null) {
          const directAngle = Math.atan2(approachY - unit.y, approachX - unit.x);
          let diff = flowAngle - directAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const diffAbs = Math.abs(diff);
          
          if (unit.isNavigatingObstacle) {
             if (diffAbs > 0.4) { // Stay in flow field mode longer
                 targetAngle = flowAngle;
                 isNavigatingObstacle = true;
             } else {
                 targetAngle = directAngle;
                 unit.isNavigatingObstacle = false;
             }
          } else {
             if (diffAbs > 0.8) { // Require strong deviation to enter obstacle mode
                 targetAngle = flowAngle;
                 isNavigatingObstacle = true;
                 unit.isNavigatingObstacle = true;
             } else {
                 targetAngle = directAngle;
             }
          }
      }
  }
  
  let angleDiff = targetAngle - unit.currentAngle;
  
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const maxTurn = unit.turnSpeed * dt;
  if (Math.abs(angleDiff) <= maxTurn) {
      unit.currentAngle = targetAngle;
  } else {
      unit.currentAngle += Math.sign(angleDiff) * maxTurn;
  }
  
  while (unit.currentAngle > Math.PI) unit.currentAngle -= Math.PI * 2;
  while (unit.currentAngle < -Math.PI) unit.currentAngle += Math.PI * 2;

  if (!isInRange) {
    vx = Math.cos(unit.currentAngle) * unit.speed;
    vy = Math.sin(unit.currentAngle) * unit.speed;
    unit.isMoving = true;
  } else {
    unit.isMoving = false;
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

  // Apply Cohesion Force (Formations)
  const releaseFormationForSlot = useSlotApproach && distToTarget < targetRadius + myRadius + unit.range + MELEE_SLOT_FORMATION_RELEASE_DISTANCE;
  if (squadCount > 1 && !releaseFormationForSlot) {
    
    let targetCx = squadCx;
    let targetCy = squadCy;
    
    if (!isBug && unit.offsetX !== undefined && unit.offsetY !== undefined && unit.initialAngle !== undefined) {
      // Humans keep strict military formation relative to squad center
      // Rotate the local offset to match the angle from squad center to target
      // This prevents the formation from spinning wildly when units individually adjust their angles
      const squadAngle = Math.atan2(target.y - squadCy, target.x - squadCx);
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
      const pullForce = unit.speed * (isInRange ? 0 : (isNavigatingObstacle ? 0.1 : (isBug ? 0.5 : 0.8))); 
      vx += Math.cos(cohAngle) * pullForce;
      vy += Math.sin(cohAngle) * pullForce;
    }
  }

  vx += steering.separationX + steering.alignmentX;
  vy += steering.separationY + steering.alignmentY;

  const recovery = getStuckRecoveryForce(unit, target, obstacles);
  vx += recovery.forceX;
  vy += recovery.forceY;
  if (recovery.isRecovering) unit.isNavigatingObstacle = true;

  // Allow a high minimum maxSpeed so collision resolution isn't throttled when speed is low or fighting
  const maxSpeed = Math.max(unit.speed * 1.5, 40);
  const desiredMag = Math.hypot(vx, vy);
  
  if (desiredMag < 0.5) {
     vx = 0;
     vy = 0;
  } else if (desiredMag > maxSpeed) {
      vx = (vx / desiredMag) * maxSpeed;
      vy = (vy / desiredMag) * maxSpeed;
  }

  const velocityBlend = Math.min(1, dt * 8);
  if (desiredMag > 0.5) {
    unit.velocity.x += (vx - unit.velocity.x) * velocityBlend;
    unit.velocity.y += (vy - unit.velocity.y) * velocityBlend;
  } else {
    unit.velocity.x *= 0.6;
    unit.velocity.y *= 0.6;
  }

  const finalMag = Math.hypot(unit.velocity.x, unit.velocity.y);
  if (finalMag < 0.5) {
    unit.velocity.x = 0;
    unit.velocity.y = 0;
  } else if (finalMag > maxSpeed) {
    unit.velocity.x = (unit.velocity.x / finalMag) * maxSpeed;
    unit.velocity.y = (unit.velocity.y / finalMag) * maxSpeed;
  }

  let nx = unit.x + unit.velocity.x * dt;
  let ny = unit.y + unit.velocity.y * dt;

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
       facingAngle: r(unit.currentAngle),
       isWalking: unit.isMoving
    });
  }
}

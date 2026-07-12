import type { BattleAction } from './combat.actions';
import type { Obstacle, SimUnit } from './combat.sim.types';
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, getSizeRadius } from './combat.utils';
import { FlowFieldMap, getFlowVector } from './combat.pathfinding';
import type { SpatialHash } from './spatial-hash';
import { getMovementNeighbors, getSteeringContext } from './combat.steering';
import { getStuckRecoveryForce, updateStuckRecovery } from './combat.stuck-recovery';
import { getPositioningDecision } from './combat.positioning';
import { getFormationCohesionForce } from './combat.formation';
import { getMovementSpeedMultiplier } from './combat.status';
import { recordChargeMovement } from './combat.charge';
import { getStanceMovementSpeedMultiplier, undeployStanceForMovement } from './combat.stance';
import { syncBurrowState } from './combat.burrow';
import { getModeMovementSpeedMultiplier, syncModeForMovement } from './combat.mode';
import { syncMovementStealth } from './combat.stealth';
import { emitMove, emitStationaryMoveIfTurning, getObstacleCorrection } from './combat.movement-helpers';

export function movementSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], dt: number, rng: PRNG, flowFieldMap: FlowFieldMap, obstacles: Obstacle[], spatialHash?: SpatialHash) {
  let vx = 0;
  let vy = 0;
  
  if (!unit.velocity) unit.velocity = { x: 0, y: 0 };
  const neighbors = getMovementNeighbors(unit, units, spatialHash);

  const distToTarget = getDistance(unit.x, unit.y, target.x, target.y);
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const distEdge = distToTarget - targetRadius - myRadius;
  const positioning = getPositioningDecision(unit, target, distEdge, targetRadius, myRadius);
  undeployStanceForMovement(unit, positioning.shouldMove, actions);
  syncModeForMovement(unit, positioning.shouldMove, actions);
  const effectiveSpeed = unit.speed * getMovementSpeedMultiplier(unit) * getStanceMovementSpeedMultiplier(unit) * getModeMovementSpeedMultiplier(unit);
  const steeringInRange = positioning.combatInRange && !positioning.shouldMove;
  updateStuckRecovery(unit, target, distToTarget, steeringInRange);
  const steering = getSteeringContext(unit, neighbors, myRadius, steeringInRange);
  const { squadCx, squadCy, squadCount } = steering;

  // Turn logic: if in a squad, aim parallel to the squad's direction to the target to prevent converging and crushing
  const facingPoint = positioning.shouldMove ? positioning.point : { x: target.x, y: target.y };

  let targetAngle = (unit.squadId && squadCount > 1 && distToTarget > unit.range * 1.5) 
      ? Math.atan2(positioning.point.y - squadCy, positioning.point.x - squadCx)
      : Math.atan2(facingPoint.y - unit.y, facingPoint.x - unit.x);
  
  let isNavigatingObstacle = false;

  // Use Flow Field if not flying to avoid obstacles
  if (!unit.isFlying && positioning.shouldMove && getDistance(unit.x, unit.y, positioning.point.x, positioning.point.y) > 20) {
      const flowAngle = getFlowVector(flowFieldMap, unit.x, unit.y, positioning.point.x, positioning.point.y);
      if (flowAngle !== null) {
          const directAngle = Math.atan2(positioning.point.y - unit.y, positioning.point.x - unit.x);
          let diff = flowAngle - directAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const diffAbs = Math.abs(diff);
          
          if (unit.isNavigatingObstacle) {
             if (diffAbs > 0.25) { // Stay in flow field mode until the direct path is clearly open
                 targetAngle = flowAngle;
                 isNavigatingObstacle = true;
             } else {
                 targetAngle = directAngle;
                 unit.isNavigatingObstacle = false;
             }
          } else {
             if (diffAbs > 0.55) { // Enter obstacle mode before diagonal routes are ignored
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

  if (effectiveSpeed <= 0) {
    unit.velocity.x = 0;
    unit.velocity.y = 0;
    unit.isMoving = false;
    syncBurrowState(unit, false, actions);
    syncMovementStealth(unit, false, actions);
    if (Math.abs(angleDiff) > 0.2) {
      const r = (v: number) => Math.round(v * 100) / 100;
      actions.push({
        unitId: unit.id,
        type: 'move',
        targetId: target.id,
        fromX: r(unit.x),
        fromY: r(unit.y),
        toX: r(unit.x),
        toY: r(unit.y),
        facingAngle: r(unit.currentAngle),
        isWalking: false
      });
    }
    return;
  }

  if (steeringInRange) {
    unit.isMoving = false;
    syncBurrowState(unit, false, actions);
    syncMovementStealth(unit, false, actions);

    vx = steering.separationX;
    vy = steering.separationY;
    if (!unit.isFlying) {
      const obstacleCorrection = getObstacleCorrection(unit, obstacles, myRadius, effectiveSpeed);
      vx += obstacleCorrection.x;
      vy += obstacleCorrection.y;
    }

    const correctionMag = Math.hypot(vx, vy);
    if (correctionMag <= 0.5) {
      unit.velocity.x = 0;
      unit.velocity.y = 0;
      emitStationaryMoveIfTurning(unit, target, actions, angleDiff);
      return;
    }

    const maxCorrectionSpeed = Math.max(effectiveSpeed * 1.2, 12);
    if (correctionMag > maxCorrectionSpeed) {
      vx = (vx / correctionMag) * maxCorrectionSpeed;
      vy = (vy / correctionMag) * maxCorrectionSpeed;
    }

    const velocityBlend = Math.min(1, dt * 8);
    unit.velocity.x += (vx - unit.velocity.x) * velocityBlend;
    unit.velocity.y += (vy - unit.velocity.y) * velocityBlend;

    const finalMag = Math.hypot(unit.velocity.x, unit.velocity.y);
    if (finalMag > maxCorrectionSpeed) {
      unit.velocity.x = (unit.velocity.x / finalMag) * maxCorrectionSpeed;
      unit.velocity.y = (unit.velocity.y / finalMag) * maxCorrectionSpeed;
    }

    const fromX = unit.x, fromY = unit.y;
    unit.x = Math.max(0, Math.min(FIELD_WIDTH, unit.x + unit.velocity.x * dt));
    unit.y = Math.max(0, Math.min(FIELD_HEIGHT, unit.y + unit.velocity.y * dt));
    emitMove(unit, target, actions, fromX, fromY, angleDiff, false);
    return
  }

  if (positioning.shouldMove) {
    vx = Math.cos(unit.currentAngle) * effectiveSpeed;
    vy = Math.sin(unit.currentAngle) * effectiveSpeed;
    unit.isMoving = true;
    syncBurrowState(unit, true, actions);
    syncMovementStealth(unit, true, actions);
  } else {
    unit.isMoving = false;
    syncBurrowState(unit, false, actions);
    syncMovementStealth(unit, false, actions);
  }

  // Soft collision with obstacles
  if (!unit.isFlying) {
     const obstacleCorrection = getObstacleCorrection(unit, obstacles, myRadius, effectiveSpeed);
     vx += obstacleCorrection.x;
     vy += obstacleCorrection.y;
  }

  const cohesion = getFormationCohesionForce(unit, positioning.point, squadCx, squadCy, squadCount, distEdge, isNavigatingObstacle);
  vx += cohesion.x;
  vy += cohesion.y;

  vx += steering.separationX + steering.alignmentX;
  vy += steering.separationY + steering.alignmentY;

  const recovery = getStuckRecoveryForce(unit, target, obstacles);
  vx += recovery.forceX;
  vy += recovery.forceY;
  if (recovery.isRecovering) unit.isNavigatingObstacle = true;

  // Keep auxiliary steering responsive without letting slow units lurch from force spikes.
  const maxSpeed = Math.max(effectiveSpeed * 1.6, 18);
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
    recordChargeMovement(unit, Math.hypot(nx - fromX, ny - fromY));
    emitMove(unit, target, actions, fromX, fromY, angleDiff, unit.isMoving);
  }
}

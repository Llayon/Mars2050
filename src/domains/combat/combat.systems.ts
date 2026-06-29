import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import { handleDeath, processSpawnAction } from './combat.systems.utils';
import { getDistance, PRNG, getSizeRadius } from './combat.utils';
import { isMeleeEngagementReady } from './combat.melee-engagement';
import { applyStatus, isActionBlockedByStatus, tickStatuses } from './combat.status';
import { applyCombatDamage } from './combat.damage';
import { tryDeployMine } from './combat.minefield';
import { getLinePierceDamageMultiplier, getLinePierceTargets } from './combat.attack-geometry';
import { applyPullOnHit } from './combat.displacement';

export function tickModifiersSystem(unit: SimUnit, dt: number, actions: BattleAction[]) {
  if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - 1);
  tickTemporaryUnit(unit, actions);
  tickStatuses(unit, actions);
}

export function actionSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], hazards: SimHazard[], actions: BattleAction[], rng: PRNG): boolean {
  const dist = getDistance(unit.x, unit.y, target.x, target.y);
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const distEdge = dist - targetRadius - myRadius;
  
  const inRange = unit.attackType === 'spawn' || (unit.attackType !== 'heal' && distEdge <= unit.range) || 
                 (unit.attackType === 'heal' && target.hp < target.maxHp && distEdge <= unit.range);

  if (!inRange) return false;
  if (!isMeleeEngagementReady(unit, target)) return false;

  // Check if facing target
  const targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
  let angleDiff = targetAngle - unit.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  
  // If angle difference is greater than 15 degrees (~0.26 radians), need to rotate first
  if (Math.abs(angleDiff) > 0.26) return false;

  if (unit.actionCooldown > 0) return false;
  if (isActionBlockedByStatus(unit)) return false;

  unit.actionCooldown = unit.actionCooldownMax; // Reset cooldown
  if (tryDeployMine(unit, target, hazards, actions, rng)) return true;

  if (unit.attackType === 'spawn') {
      return processSpawnAction(unit, target, units, actions, rng);
  }

  if (unit.attackType === 'heal') {

     const healAmount = unit.attack;
     target.hp = Math.min(target.maxHp, target.hp + healAmount);
     actions.push({ unitId: unit.id, type: 'heal', targetId: target.id, damage: healAmount });
  } else {
     const numShots = unit.multishot || 1;
     for (let shot = 0; shot < numShots; shot++) {
         if (target.isDead) break;

         emitAttackIntent(unit, target, actions);
         applyCombatDamage(unit, target, unit.attack, actions, createDamageContext(unit, units, actions, hazards, rng));

         unit.hasAttacked = true;

         applyOnHitStatuses(unit, target, actions);

         if (unit.leavesPuddle) {
             hazards.push({
                 id: 'hazard_' + Math.floor(rng.next() * 1000000),
                 team: unit.team,
                 type: 'napalm',
                 x: target.x,
                 y: target.y,
                 radius: 40,
                 damagePerTick: Math.floor(unit.attack * 0.2),
                 duration: 50 // 5 seconds
             });
         }

         if (target.hp <= 0 && !target.isDead) {
             handleDeath(target, unit, units, actions, hazards, rng);
         }

         processLinePierce(unit, target, units, actions, hazards, rng);

         if (unit.attackType === 'aoe' && unit.aoeRadius) {
             const radius = unit.aoeRadius;
             const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target.id);
             for (const e of splashEnemies) {
                 if (getDistance(target.x, target.y, e.x, e.y) <= radius) {
                     emitAttackIntent(unit, e, actions);
                     applyCombatDamage(unit, e, Math.floor(unit.attack * 0.5), actions, createDamageContext(unit, units, actions, hazards, rng));

                     applyOnHitStatuses(unit, e, actions);

                     if (e.hp <= 0 && !e.isDead) {
                         handleDeath(e, unit, units, actions, hazards, rng);
                     }
                 }
             }
         }

         applyPullOnHit(unit, target, units, actions);
     }
  }
  return true;
}

function applyOnHitStatuses(unit: SimUnit, target: SimUnit, actions: BattleAction[]): void {
  if (unit.appliesEmp) applyStatus(target, { type: 'emp', duration: 30, sourceUnitId: unit.id }, actions);
  for (const status of unit.statusOnHit ?? []) {
    applyStatus(target, { ...status, sourceUnitId: unit.id }, actions);
  }
}

function emitAttackIntent(unit: SimUnit, target: SimUnit, actions: BattleAction[]): void {
  actions.push({ unitId: unit.id, type: 'attack', targetId: target.id });
}

function processLinePierce(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const multiplier = getLinePierceDamageMultiplier(unit);
  if (!multiplier) return;

  for (const secondary of getLinePierceTargets(unit, target, units)) {
    emitAttackIntent(unit, secondary, actions);
    applyCombatDamage(unit, secondary, Math.floor(unit.attack * multiplier), actions, createDamageContext(unit, units, actions, hazards, rng));
    applyOnHitStatuses(unit, secondary, actions);
    if (secondary.hp <= 0 && !secondary.isDead) handleDeath(secondary, unit, units, actions, hazards, rng);
  }
}

function createDamageContext(unit: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG) {
  return { units, onUnitDeath: (target: SimUnit) => handleDeath(target, unit, units, actions, hazards, rng) };
}

function tickTemporaryUnit(unit: SimUnit, actions: BattleAction[]): void {
  if (!unit.isTemporary || unit.temporaryDuration === undefined || unit.isDead) return;
  unit.temporaryDuration--;
  if (unit.temporaryDuration > 0) return;

  unit.isDead = true;
  actions.push({ unitId: unit.id, type: 'die' });
}

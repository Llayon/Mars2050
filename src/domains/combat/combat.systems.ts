import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import type { UnitTypeKey } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { handleDeath, processSpawnAction } from './combat.systems.utils';
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG, getSizeRadius } from './combat.utils';
import { isMeleeEngagementReady } from './combat.melee-engagement';

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

  unit.actionCooldown = unit.actionCooldownMax; // Reset cooldown

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

         let damage = Math.max(1, unit.attack - target.defense);
         if (target.isFlying && unit.antiAirDamageMult) {
             damage = Math.floor(damage * unit.antiAirDamageMult);
         }
         if (!target.isFlying && unit.groundDamageMult) {
             damage = Math.floor(damage * unit.groundDamageMult);
         }
         
         if (target.isMoving && target.damageReductionWhileMoving) {
             damage = Math.floor(damage * (1 - target.damageReductionWhileMoving));
         }

         let hitShield = false;
         // Portable Shield Logic (absorbs overflow damage completely)
         if (target.shield > 0) {
             hitShield = true;
             if (target.shield >= damage) {
                 target.shield -= damage;
                 damage = 0;
             } else {
                 target.shield = 0;
                 damage = 0; // Shield breaks but absorbs the rest of this hit
             }
         }

         if (unit.executeThreshold && target.hp <= unit.executeThreshold) {
             damage = target.hp; // Insta-kill
         }
         
         if (unit.lifestealMult && damage > 0) {
             const heal = Math.floor(damage * unit.lifestealMult);
             unit.hp = Math.min(unit.maxHp, unit.hp + heal);
         }

         if (damage > 0) {
             target.hp -= damage;
         }
         
         unit.hasAttacked = true;
         
         actions.push({ unitId: unit.id, type: 'attack', targetId: target.id, damage, isShieldHit: hitShield });

         if (unit.appliesEmp) {
             target.statusEffects.push({ type: 'emp', duration: 30 });
         }

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

         if (unit.attackType === 'aoe' && unit.aoeRadius) {
             const radius = unit.aoeRadius;
             const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target.id);
             for (const e of splashEnemies) {
                 if (getDistance(target.x, target.y, e.x, e.y) <= radius) {
                     let splash = Math.max(1, Math.floor(unit.attack * 0.5) - e.defense);
                     
                     if (e.isFlying && unit.antiAirDamageMult) splash = Math.floor(splash * unit.antiAirDamageMult);
                     if (!e.isFlying && unit.groundDamageMult) splash = Math.floor(splash * unit.groundDamageMult);
                     if (e.isMoving && e.damageReductionWhileMoving) splash = Math.floor(splash * (1 - e.damageReductionWhileMoving));

                     let hitShield = false;
                     if (e.shield > 0) {
                         hitShield = true;
                         if (e.shield >= splash) {
                             e.shield -= splash;
                             splash = 0;
                         } else {
                             e.shield = 0;
                             splash = 0;
                         }
                     }

                     if (unit.executeThreshold && e.hp <= unit.executeThreshold) {
                         splash = e.hp; // Insta-kill
                     }
                     
                     if (unit.lifestealMult && splash > 0) {
                         const heal = Math.floor(splash * unit.lifestealMult);
                         unit.hp = Math.min(unit.maxHp, unit.hp + heal);
                     }

                     if (splash > 0) e.hp -= splash;
                     
                     actions.push({ unitId: unit.id, type: 'attack', targetId: e.id, damage: splash, isShieldHit: hitShield });
                     
                     if (unit.appliesEmp) e.statusEffects.push({ type: 'emp', duration: 30 });

                     if (e.hp <= 0 && !e.isDead) {
                         handleDeath(e, unit, units, actions, hazards, rng);
                     }
                 }
             }
         }
     }
  }
  return true;
}


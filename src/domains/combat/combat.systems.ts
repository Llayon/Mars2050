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
     const numShots = unit.multishot || 1;
     for (let shot = 0; shot < numShots; shot++) {
         if (target.isDead) break;

         let damage = Math.max(1, unit.attack - target.defense);
         if (target.isFlying && unit.antiAirDamageMult) {
             damage = Math.floor(damage * unit.antiAirDamageMult);
         }
         
         if (target.isMoving && target.damageReductionWhileMoving) {
             damage = Math.floor(damage * (1 - target.damageReductionWhileMoving));
         }

         // Portable Shield Logic (absorbs overflow damage completely)
         if (target.shield > 0) {
             if (target.shield >= damage) {
                 target.shield -= damage;
                 damage = 0;
             } else {
                 target.shield = 0;
                 damage = 0; // Shield breaks but absorbs the rest of this hit
             }
         }

         if (damage > 0) {
             target.hp -= damage;
         }
         
         actions.push({ unitId: unit.id, type: 'attack', targetId: target.id, damage });

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

         const handleDeath = (t: SimUnit) => {
             t.isDead = true;
             actions.push({ unitId: t.id, type: 'die' });
             if (t.onDeathPuddle) {
                 hazards.push({
                     id: 'hazard_' + Math.floor(rng.next() * 1000000),
                     team: t.team,
                     type: t.onDeathPuddle,
                     x: t.x,
                     y: t.y,
                     radius: 50,
                     damagePerTick: t.onDeathPuddle === 'acid' ? Math.floor(t.maxHp * 0.1) : 10,
                     duration: 40
                 });
             }
             if (unit.replicateOnKill) {
                 const newId = 'clone_' + Math.floor(rng.next() * 1000000);
                 units.push({
                     ...unit,
                     id: newId,
                     hp: unit.maxHp,
                     x: t.x,
                     y: t.y,
                     actionCooldown: 0,
                     shield: unit.maxShield,
                     statusEffects: [],
                     isDead: false,
                     squadId: undefined
                 });
                 actions.push({ 
                     unitId: unit.id, 
                     type: 'spawn', 
                     toX: t.x, 
                     toY: t.y, 
                     spawnType: unit.type, 
                     spawnTeam: unit.team, 
                     spawnMaxHp: unit.maxHp,
                     targetId: newId
                 });
             }
         };

         if (target.hp <= 0 && !target.isDead) {
             handleDeath(target);
         }

         if (unit.attackType === 'aoe' && unit.aoeRadius) {
             const radius = unit.aoeRadius;
             const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target.id);
             for (const e of splashEnemies) {
                 if (getDistance(target.x, target.y, e.x, e.y) <= radius) {
                     let splash = Math.max(1, Math.floor(unit.attack * 0.5) - e.defense);
                     
                     if (e.isFlying && unit.antiAirDamageMult) splash = Math.floor(splash * unit.antiAirDamageMult);
                     if (e.isMoving && e.damageReductionWhileMoving) splash = Math.floor(splash * (1 - e.damageReductionWhileMoving));

                     if (e.shield > 0) {
                         if (e.shield >= splash) {
                             e.shield -= splash;
                             splash = 0;
                         } else {
                             e.shield = 0;
                             splash = 0;
                         }
                     }

                     if (splash > 0) e.hp -= splash;
                     
                     actions.push({ unitId: unit.id, type: 'attack', targetId: e.id, damage: splash });
                     
                     if (unit.appliesEmp) e.statusEffects.push({ type: 'emp', duration: 30 });

                     if (e.hp <= 0 && !e.isDead) {
                         handleDeath(e);
                     }
                 }
             }
         }
     }
  }
  return true;
}


import { SimUnit, BattleAction } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { getDistance } from './combat.utils';
import { GRID_WIDTH, GRID_HEIGHT } from './combat.config';

// --- ECS Systems ---


export function tickModifiersSystem(unit: SimUnit) {
  if (unit.actionCooldown > 0) unit.actionCooldown--;
}

export function targetingSystem(unit: SimUnit, units: SimUnit[]): SimUnit | null {
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
    const enemies = units.filter(e => !e.isDead && e.team !== unit.team);
    if (enemies.length === 0) return null;
    for (const enemy of enemies) {
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

export function actionSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[]): boolean {
  if (unit.actionCooldown > 0) return false;

  const dist = getDistance(unit.x, unit.y, target.x, target.y);
  const canAct = (unit.attackType !== 'heal' && dist <= unit.range) || 
                 (unit.attackType === 'heal' && target.hp < target.maxHp && dist <= unit.range);

  if (!canAct) return false;

  unit.actionCooldown = unit.actionCooldownMax; // Reset cooldown

  if (unit.attackType === 'spawn') {
     // Spawn a turret directly in front of the engineer (towards target)
     let dx = Math.sign(target.x - unit.x);
     let dy = Math.sign(target.y - unit.y);
     let spawnX = unit.x + dx;
     let spawnY = unit.y + dy;
     
     // Check if spawn position is occupied or out of bounds
     if (spawnX < 0 || spawnX >= 10 || spawnY < 0 || spawnY >= 18 || units.some(u => !u.isDead && u.x === spawnX && u.y === spawnY)) {
        spawnX = unit.x; // Fallback to current position (stacked)
        spawnY = unit.y;
     }

     const newId = 'spawn_' + Math.random().toString(36).substr(2, 9);
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

     if (target.hp <= 0) {
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
             if (e.hp <= 0) {
               e.isDead = true;
               actions.push({ unitId: e.id, type: 'die' });
             }
          }
       }
     }
  }
  return true;
}

export function movementSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[]) {
  if (unit.speed <= 0) return;
  
  unit.moveTimer = (unit.moveTimer || 0) + unit.speed;
  if (unit.moveTimer >= 10) {
    unit.moveTimer -= 10;
    
    let bestX = unit.x;
    let bestY = unit.y;
    let bestDist = getDistance(unit.x, unit.y, target.x, target.y);

    const moves = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    for (const move of moves) {
      const nx = unit.x + move.dx;
      const ny = unit.y + move.dy;
      if (nx < 0 || nx >= 10 || ny < 0 || ny >= 18) continue; // Hardcoded bounds temporarily since GRID_WIDTH/HEIGHT might not be imported
      
      const occupied = units.some(u => !u.isDead && u.x === nx && u.y === ny);
      if (occupied) continue;

      const dist = getDistance(nx, ny, target.x, target.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = nx;
        bestY = ny;
      }
    }

    if (bestX !== unit.x || bestY !== unit.y) {
      const fromX = unit.x, fromY = unit.y;
      unit.x = bestX; unit.y = bestY;
      actions.push({ unitId: unit.id, type: 'move', fromX, fromY, toX: bestX, toY: bestY });
    }
  }
}

// --- End ECS Systems ---

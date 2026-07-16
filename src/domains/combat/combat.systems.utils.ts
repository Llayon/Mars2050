import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import type { UnitTypeKey } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { PRNG, FIELD_WIDTH, FIELD_HEIGHT } from './combat.utils';
import { resolveUnitDeath } from './combat.death';
import { createRuntimeUnitFromConfig } from './combat.unit-factory';

/**
 * Handles death logic for a unit, including resurrections, on-death puddles, and clone spawning.
 * @param t The unit that died
 * @param unit The unit that caused the death
 * @param units The global list of units
 * @param actions The global list of actions
 * @param hazards The global list of hazards
 * @param rng The PRNG instance
 */
export function handleDeath(t: SimUnit, unit: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG) {
    resolveUnitDeath(t, unit, 'weapon', { units, hazards, actions, rng });
}

/**
 * Processes the spawn action for a unit that creates new units in combat.
 * @param unit The unit performing the spawn action
 * @param target The target unit (used to determine spawn direction)
 * @param units The global list of units
 * @param actions The global list of actions
 * @param rng The PRNG instance
 * @returns true if the spawn was successful
 */
export function processSpawnAction(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], rng: PRNG): boolean {
     if (isSpawnCapReached(unit, units)) {
        const cap = unit.spawnCap ?? 0;
        unit.actionCooldown = Math.min(5, unit.actionCooldownMax);
        actions.push({ unitId: unit.id, type: 'spawn_blocked', value: cap });
        return false;
     }

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
     if (!spawnConfig) return false;
     const sourceConfig = UNIT_TYPES[unit.type as UnitTypeKey];
     const overrides = sourceConfig?.baseStats.spawnOverrides;
     const spawnHp = overrides?.hp ?? spawnConfig.baseStats.hp;

     const spawned = createRuntimeUnitFromConfig({
       id: newId,
       team: unit.team,
       type: spawnType,
       hp: spawnHp,
       attack: overrides?.attack ?? spawnConfig.baseStats.attack,
       isTemporary: overrides?.isTemporary,
       temporaryDuration: overrides?.duration,
       currentAngle: unit.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
       x: spawnX,
       y: spawnY,
       summonOwnerId: unit.id,
     });
     if (!spawned) return false;
     units.push(spawned);

     actions.push({ 
       unitId: unit.id, 
       type: 'spawn', 
       toX: spawnX, 
       toY: spawnY, 
       spawnType: spawnType, 
       spawnTeam: unit.team, 
       spawnMaxHp: spawnHp,
       targetId: newId
     });
     return true;
}

function isSpawnCapReached(unit: SimUnit, units: SimUnit[]): boolean {
     if (unit.spawnCap === undefined) return false;
     const activeSummons = units.filter(u => !u.isDead && u.summonOwnerId === unit.id).length;
     return activeSummons >= unit.spawnCap;
}

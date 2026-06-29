import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import type { UnitTypeKey } from './combat.types';
import { UNIT_TYPES } from './combat.config';
import { PRNG, FIELD_WIDTH, FIELD_HEIGHT } from './combat.utils';

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
    if (t.resurrectOnce) {
        t.hp = t.maxHp;
        t.resurrectOnce = false;
        actions.push({ unitId: t.id, type: 'heal', targetId: t.id, damage: t.maxHp });
        return;
    }
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
            targetMark: undefined,
            attackTargetId: undefined,
            meleeSlotTargetId: undefined,
            meleeSlotIndex: undefined,
            aggroLockTicks: 0,
            velocity: { x: 0, y: 0 },
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
     const sourceConfig = UNIT_TYPES[unit.type as UnitTypeKey];
     const overrides = sourceConfig?.baseStats.spawnOverrides;
     const spawnHp = overrides?.hp ?? spawnConfig.baseStats.hp;
     
     units.push({
       id: newId,
       team: unit.team,
       type: spawnType,
       hp: spawnHp,
       maxHp: spawnHp,
       attack: overrides?.attack ?? spawnConfig.baseStats.attack,
       defense: spawnConfig.baseStats.defense,
       speed: spawnConfig.baseStats.speed,
       range: spawnConfig.baseStats.range,
       attackType: spawnConfig.baseStats.attackType || 'single',
       aoeRadius: spawnConfig.baseStats.aoeRadius,
       spawnType: spawnConfig.baseStats.spawnType,
       spawnCap: spawnConfig.baseStats.spawnCap,
       actionCooldownMax: spawnConfig.baseStats.actionCooldownMax || 5,
       actionCooldown: 0,
       isFlying: spawnConfig.baseStats.isFlying || false,
       canTargetAir: spawnConfig.baseStats.canTargetAir || false,
       isTemporary: overrides?.isTemporary,
       temporaryDuration: overrides?.duration,
       turnSpeed: spawnConfig.baseStats.turnSpeed || 5,
       currentAngle: unit.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
       size: spawnConfig.baseStats.size || 'M',
       x: spawnX,
       y: spawnY,
       summonOwnerId: unit.id,
       aggroLockTicks: 0,
       velocity: { x: 0, y: 0 },
       isDead: false,
       shield: 0,
       maxShield: 0,
       statusEffects: [],
       statusOnHit: spawnConfig.baseStats.statusOnHit ? spawnConfig.baseStats.statusOnHit.map(status => ({ ...status })) : undefined,
       markOnHit: spawnConfig.baseStats.markOnHit ? { ...spawnConfig.baseStats.markOnHit } : undefined,
       supportAuras: spawnConfig.baseStats.supportAuras ? spawnConfig.baseStats.supportAuras.map(aura => ({ ...aura })) : undefined
     });

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

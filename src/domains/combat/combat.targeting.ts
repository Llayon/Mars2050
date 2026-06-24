import type { SimUnit } from './combat.sim.types';
import { UNIT_TYPES } from './combat.config';
import { DEFAULT_TARGETING_PROFILE, TARGETING_PROFILES } from './combat.targeting.config';
import { getDistance, getSizeRadius } from './combat.utils';
import type { SpatialHash } from './spatial-hash';
import type { CombatTag, TargetingProfileConfig, TargetingProfileKey } from './combat.types';

const AGGRO_LOCK_TICKS = 10;
const AGGRO_LEASH_MULTIPLIER = 1.5;
const MELEE_ACQUISITION_RADIUS = 240;
const RANGED_ACQUISITION_BUFFER = 120;

export function targetingSystem(unit: SimUnit, units: SimUnit[], meleeTargetCounts: Record<string, number>, spatialHash?: SpatialHash): SimUnit | null {
  if (unit.attackType === 'heal') {
    return selectHealTarget(unit, units);
  }

  const lockedTarget = getLockedTarget(unit, units, meleeTargetCounts);
  if (lockedTarget) {
    unit.aggroLockTicks = Math.max(0, unit.aggroLockTicks - 1);
    return lockedTarget;
  }

  const candidates = getAcquisitionCandidates(unit, units, spatialHash);
  const enemies = candidates.filter(e => isReachableEnemy(unit, e));
  if (enemies.length === 0) {
    unit.attackTargetId = undefined;
    unit.aggroLockTicks = 0;
    return selectMovementFallback(unit, units, meleeTargetCounts);
  }
  
  // Filter out enemies that are already fully surrounded (if this is a melee unit)
  let validEnemies = enemies;
  if (unit.range <= 60) {
     validEnemies = enemies.filter(e => hasMeleeSlot(unit, e, meleeTargetCounts));
     
     // Fallback: if all enemies are perfectly surrounded, just walk towards the best one anyway
     if (validEnemies.length === 0) validEnemies = enemies;
  }

  const target = selectAggroTarget(unit, validEnemies);
  if (!target) {
    unit.attackTargetId = undefined;
    unit.aggroLockTicks = 0;
    return null;
  }

  unit.attackTargetId = target.id;
  unit.aggroLockTicks = AGGRO_LOCK_TICKS;
  return target;
}

function getAcquisitionCandidates(unit: SimUnit, units: SimUnit[], spatialHash?: SpatialHash): SimUnit[] {
  if (isFullMapAcquisitionUnit(unit)) return units;

  const radius = getAcquisitionRadius(unit);
  if (spatialHash) return spatialHash.query(unit.x, unit.y, radius);
  return units.filter(candidate => getDistance(unit.x, unit.y, candidate.x, candidate.y) <= radius);
}

function selectHealTarget(unit: SimUnit, candidates: SimUnit[]): SimUnit | null {
  let target: SimUnit | null = null;
  let minDistance = Infinity;
  let allies = candidates.filter(a => !a.isDead && a.team === unit.team && a.hp < a.maxHp && a.id !== unit.id);
  if (allies.length === 0) allies = candidates.filter(a => !a.isDead && a.team === unit.team && a.id !== unit.id);

  for (const ally of allies) {
    const dist = getDistance(unit.x, unit.y, ally.x, ally.y);
    if (dist < minDistance) {
      minDistance = dist;
      target = ally;
    }
  }

  return target;
}

function getLockedTarget(unit: SimUnit, candidates: SimUnit[], meleeTargetCounts: Record<string, number>): SimUnit | null {
  if (!unit.attackTargetId || unit.aggroLockTicks <= 0) return null;

  const target = candidates.find(candidate => candidate.id === unit.attackTargetId);
  if (target && isReachableEnemy(unit, target) && isWithinLeash(unit, target) && hasMeleeSlot(unit, target, meleeTargetCounts)) return target;

  unit.attackTargetId = undefined;
  unit.aggroLockTicks = 0;
  return null;
}

function selectMovementFallback(unit: SimUnit, units: SimUnit[], meleeTargetCounts: Record<string, number>): SimUnit | null {
  const enemies = units.filter(e => isReachableEnemy(unit, e));
  if (enemies.length === 0) return null;

  let validEnemies = enemies;
  if (unit.range <= 60) {
    validEnemies = enemies.filter(e => hasMeleeSlot(unit, e, meleeTargetCounts));
    if (validEnemies.length === 0) validEnemies = enemies;
  }

  return selectNearestTarget(unit, validEnemies);
}

function isReachableEnemy(unit: SimUnit, enemy: SimUnit): boolean {
  return !enemy.isDead &&
    enemy.team !== unit.team &&
    (!enemy.isFlying || unit.canTargetAir) &&
    !(enemy.stealthUntilAttack && !enemy.hasAttacked);
}

function hasMeleeSlot(unit: SimUnit, target: SimUnit, meleeTargetCounts: Record<string, number>): boolean {
  if (unit.range > 60) return true;

  const slotsTaken = meleeTargetCounts[target.id] || 0;
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const circumference = 2 * Math.PI * (targetRadius + myRadius);
  const maxSlots = Math.floor(circumference / (myRadius * 2));
  return slotsTaken < maxSlots;
}

function getAcquisitionRadius(unit: SimUnit): number {
  if (unit.range <= 60) return MELEE_ACQUISITION_RADIUS;
  return Math.max(MELEE_ACQUISITION_RADIUS, unit.range + RANGED_ACQUISITION_BUFFER);
}

function isFullMapAcquisitionUnit(unit: SimUnit): boolean {
  return getTargetingProfile(unit).acquisition === 'global';
}

function isWithinLeash(unit: SimUnit, target: SimUnit): boolean {
  if (isFullMapAcquisitionUnit(unit)) return true;
  return getDistance(unit.x, unit.y, target.x, target.y) <= getAcquisitionRadius(unit) * AGGRO_LEASH_MULTIPLIER;
}

function selectAggroTarget(unit: SimUnit, enemies: SimUnit[]): SimUnit | null {
  let target: SimUnit | null = null;
  let bestScore = -Infinity;
  const profile = getTargetingProfile(unit);

  for (const enemy of enemies) {
    const score = getAggroScore(unit, enemy, profile);
    if (!target || score > bestScore || (score === bestScore && isBetterTie(unit, enemy, target))) {
      target = enemy;
      bestScore = score;
    }
  }

  return target;
}

function selectNearestTarget(unit: SimUnit, enemies: SimUnit[]): SimUnit | null {
  let target: SimUnit | null = null;

  for (const enemy of enemies) {
    if (!target || isBetterTie(unit, enemy, target)) {
      target = enemy;
    }
  }

  return target;
}

function getAggroScore(unit: SimUnit, enemy: SimUnit, profile: TargetingProfileConfig): number {
  const distance = Math.max(1, getDistance(unit.x, unit.y, enemy.x, enemy.y));
  const distanceScore = profile.distanceWeight / distance;
  const currentTargetScore = enemy.id === unit.attackTargetId ? profile.currentTargetBonus : 0;
  const hpRatio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 1;
  const lowHpScore = (1 - hpRatio) * profile.lowHpWeight;
  return distanceScore + currentTargetScore + lowHpScore + getCombatTagScore(enemy, profile);
}

function isBetterTie(unit: SimUnit, candidate: SimUnit, current: SimUnit): boolean {
  const candidateDistance = getDistance(unit.x, unit.y, candidate.x, candidate.y);
  const currentDistance = getDistance(unit.x, unit.y, current.x, current.y);
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance;
  if (candidate.hp !== current.hp) return candidate.hp < current.hp;
  return candidate.id < current.id;
}

function getTargetingProfile(unit: SimUnit): TargetingProfileConfig {
  return TARGETING_PROFILES[getTargetingProfileKey(unit)];
}

function getTargetingProfileKey(unit: SimUnit): TargetingProfileKey {
  return UNIT_TYPES[unit.type as keyof typeof UNIT_TYPES]?.baseStats.targetingProfile ?? DEFAULT_TARGETING_PROFILE;
}

function getCombatTagScore(enemy: SimUnit, profile: TargetingProfileConfig): number {
  let score = 0;
  for (const tag of getEffectiveCombatTags(enemy)) {
    score += profile.preferredTags?.[tag] ?? 0;
    score -= profile.avoidedTags?.[tag] ?? 0;
  }
  return score;
}

function getEffectiveCombatTags(unit: SimUnit): Set<CombatTag> {
  const tags = new Set<CombatTag>(UNIT_TYPES[unit.type as keyof typeof UNIT_TYPES]?.baseStats.combatTags ?? []);
  if (unit.isFlying) tags.add('aircraft');
  if (unit.shield > 0) tags.add('shielded');
  if (unit.attackType === 'heal') tags.add('healer');
  if (unit.attackType === 'spawn') tags.add('summoner');
  return tags;
}

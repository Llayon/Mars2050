import type { BattleAction } from './combat.actions';
import type { SimHazard, SimUnit } from './combat.sim.types';
import { handleDeath, processSpawnAction } from './combat.systems.utils';
import { getDistance, PRNG, getSizeRadius } from './combat.utils';
import { isMeleeEngagementReady } from './combat.melee-engagement';
import { applyStatus, getActionCooldownRecovery, isActionBlockedByStatus, tickStatuses } from './combat.status';
import { applyCombatDamage } from './combat.damage';
import { tryDeployMine } from './combat.minefield';
import { tryDeploySmoke } from './combat.smoke';
import { getBarrageDamageMultiplier, getBarrageImpacts, getBarrageTargets, getBeamDamageMultiplier, getBeamTargets, getChainTargets, getConeDamageMultiplier, getConeTargets, getLinePierceDamageMultiplier, getLinePierceTargets } from './combat.attack-geometry';
import { applyKnockbackOnHit, applyPullOnHit } from './combat.displacement';
import { applyTargetMark, tickTargetMark } from './combat.mark';
import { getEffectiveActionRangeAgainst, getMinimumActionRange } from './combat.weapon-rules';
import { getSideWeaponDamage, getSideWeaponTargets } from './combat.side-weapon';
import { getRampDamage } from './combat.ramp';
import { getOutputSuppressedActionCooldown } from './combat.output-suppression';
import { isProjectileInterceptableAttack } from './combat.projectile-defense';
import { getChargeDamage } from './combat.charge';
import { consumeAttackCharge } from './combat.growth-charge';
import { processConditionalAttack, processSweepAttack } from './combat.conditional-weapons';
import { allowsSplitFireMinimumDamage, getSplitFireDamageMultiplier, getSplitFireTargets } from './combat.split-fire';
import { canReceiveHealAction } from './combat.support';
import { canAttackControlledTarget } from './combat.control';
import { getStanceActionCooldown, getStanceSetupActionRange, prepareStanceForAction } from './combat.stance';
import { syncBurrowState } from './combat.burrow';
import { syncModeForAction } from './combat.mode';
import { recordAttackTrigger, recordDamageTakenTrigger, tickTriggerCooldowns } from './combat.triggers';
import { breakMovementStealthOnAttack } from './combat.stealth';

export function tickModifiersSystem(unit: SimUnit, dt: number, actions: BattleAction[]) {
  if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - getActionCooldownRecovery(unit));
  if ((unit.projectileInterceptCooldown ?? 0) > 0) unit.projectileInterceptCooldown = Math.max(0, (unit.projectileInterceptCooldown ?? 0) - 1);
  tickTemporaryUnit(unit, actions); tickStatuses(unit, actions); tickTargetMark(unit, actions); tickTriggerCooldowns(unit);
}
export function actionSystem(unit: SimUnit, target: SimUnit, units: SimUnit[], hazards: SimHazard[], actions: BattleAction[], rng: PRNG, tick = 0): boolean {
  const dist = getDistance(unit.x, unit.y, target.x, target.y);
  const targetRadius = getSizeRadius(target.size);
  const myRadius = getSizeRadius(unit.size);
  const distEdge = dist - targetRadius - myRadius;
  const effectiveRange = getEffectiveActionRangeAgainst(unit, target);
  const minimumRange = getMinimumActionRange(unit);
  const setupRange = getStanceSetupActionRange(unit, effectiveRange);
  const inRange = unit.attackType === 'spawn' || (unit.attackType !== 'heal' && (minimumRange <= 0 || distEdge >= minimumRange) && distEdge <= setupRange) ||
                 (unit.attackType === 'heal' && canReceiveHealAction(unit, target) && target.hp < target.maxHp && distEdge <= effectiveRange);
  if (!inRange) return false;
  if (!isMeleeEngagementReady(unit, target)) return false;

  const targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
  let angleDiff = targetAngle - unit.currentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  if (Math.abs(angleDiff) > 0.26) return false;
  if (unit.actionCooldown > 0) return false;
  if (isActionBlockedByStatus(unit)) return false;
  if (unit.attackType !== 'heal' && target.team === unit.team && !canAttackControlledTarget(unit, target)) return false;
  if (!prepareStanceForAction(unit, actions)) return true;

  syncModeForAction(unit, actions); syncBurrowState(unit, false, actions); unit.actionCooldown = getOutputSuppressedActionCooldown(unit, getStanceActionCooldown(unit)); // Reset cooldown
  if (tryDeployMine(unit, target, hazards, actions, rng) || tryDeploySmoke(unit, target, hazards, actions, rng)) return true;
  if (unit.attackType === 'spawn') return processSpawnAction(unit, target, units, actions, rng);
  if (unit.attackType === 'heal') {
     const healAmount = unit.attack;
     target.hp = Math.min(target.maxHp, target.hp + healAmount);
     actions.push({ unitId: unit.id, type: 'heal', targetId: target.id, damage: healAmount });
  } else {
     const numShots = unit.multishot || 1;
     for (let shot = 0; shot < numShots; shot++) {
         if (target.isDead) break;

         emitAttackIntent(unit, target, actions);
         const emergeStrike = unit.emergeStrikePending;
         unit.emergeStrikePending = undefined;
         let attackDamage = getChargeDamage(unit, target, getRampDamage(unit, target, unit.attack, actions), actions);
         if (emergeStrike?.attackMult) attackDamage = Math.floor(attackDamage * emergeStrike.attackMult);
         const primaryDamage = consumeAttackCharge(unit, attackDamage, actions, tick);
         const triggerContext = createTriggerContext(unit, units, actions, hazards, rng, tick);
         const damageResult = applyCombatDamage(
           unit,
           target,
           primaryDamage,
           actions,
           createDamageContext(unit, units, actions, hazards, rng, true, isProjectileInterceptableAttack(unit))
         );

         unit.hasAttacked = true; breakMovementStealthOnAttack(unit, actions);
         if (damageResult.intercepted) continue;
         recordAttackTrigger(unit, target, triggerContext);
         recordDamageTakenTrigger(unit, target, damageResult.damage + damageResult.sharedDamage, triggerContext);

         applyOnHitStatuses(unit, target, actions);
         applyTargetMark(unit, target, actions, units);
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
         processConeAttack(unit, target, units, actions, hazards, rng);
         processBeamAttack(unit, target, units, actions, hazards, rng);
         processBarrageAttack(unit, target, units, actions, hazards, rng);
         processChainAttack(unit, target, units, actions, hazards, rng);
         processSplitFireAttack(unit, target, units, actions, hazards, rng);
         processSideWeaponAttack(unit, target, units, actions, hazards, rng);
         processConditionalAttack(unit, target, units, actions, hazards, rng);
         processSweepAttack(unit, target, units, actions, hazards, rng);
         if (unit.attackType === 'aoe' && (unit.aoeRadius || emergeStrike?.aoeRadiusAdd)) {
             const radius = (unit.aoeRadius ?? 0) + (emergeStrike?.aoeRadiusAdd ?? 0);
             const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target.id);
             for (const e of splashEnemies) {
                 if (getDistance(target.x, target.y, e.x, e.y) <= radius) {
                     emitAttackIntent(unit, e, actions);
                     applyCombatDamage(unit, e, Math.floor(unit.attack * 0.5), actions, createDamageContext(unit, units, actions, hazards, rng, false, false));

                     applyOnHitStatuses(unit, e, actions);
                     applyTargetMark(unit, e, actions);

                     if (e.hp <= 0 && !e.isDead) {
                         handleDeath(e, unit, units, actions, hazards, rng);
                     }
                 }
             }
         }
         applyPullOnHit(unit, target, units, actions);
         applyKnockbackOnHit(unit, target, units, actions);
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
    applyCombatDamage(unit, secondary, Math.floor(unit.attack * multiplier), actions, createDamageContext(unit, units, actions, hazards, rng, false, false));
    applyOnHitStatuses(unit, secondary, actions);
    applyTargetMark(unit, secondary, actions);
    if (secondary.hp <= 0 && !secondary.isDead) handleDeath(secondary, unit, units, actions, hazards, rng);
  }
}

function processConeAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const multiplier = getConeDamageMultiplier(unit);
  if (!multiplier) return;

  actions.push({ unitId: unit.id, type: 'cone_attack', targetId: target.id, radius: unit.range, value: multiplier });
  applySecondaryWeaponTargets(unit, getConeTargets(unit, target, units), multiplier, units, actions, hazards, rng);
}

function processBeamAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const multiplier = getBeamDamageMultiplier(unit);
  if (!multiplier) return;

  actions.push({ unitId: unit.id, type: 'beam_tick', targetId: target.id, radius: unit.range, value: multiplier });
  applySecondaryWeaponTargets(unit, getBeamTargets(unit, target, units), multiplier, units, actions, hazards, rng);
}

function processBarrageAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const multiplier = getBarrageDamageMultiplier(unit);
  if (!multiplier) return;

  for (const impact of getBarrageImpacts(unit, target)) {
    actions.push({ unitId: unit.id, type: 'barrage_marker', targetId: target.id, toX: impact.x, toY: impact.y, radius: impact.radius, value: impact.index });
    applySecondaryWeaponTargets(unit, getBarrageTargets(unit, impact, units), multiplier, units, actions, hazards, rng, true);
    actions.push({ unitId: unit.id, type: 'barrage_impact', targetId: target.id, toX: impact.x, toY: impact.y, radius: impact.radius, value: impact.index });
  }
}

function processChainAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  for (const hit of getChainTargets(unit, target, units)) {
    actions.push({ unitId: unit.id, type: 'chain_jump', targetId: hit.target.id, value: hit.jump });
    applyCombatDamage(unit, hit.target, Math.floor(unit.attack * hit.multiplier), actions, createDamageContext(unit, units, actions, hazards, rng, false, false));
    applyOnHitStatuses(unit, hit.target, actions);
    applyTargetMark(unit, hit.target, actions);
    if (hit.target.hp <= 0 && !hit.target.isDead) handleDeath(hit.target, unit, units, actions, hazards, rng);
  }
}

function processSplitFireAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const multiplier = getSplitFireDamageMultiplier(unit);
  if (!multiplier) return;

  for (const secondary of getSplitFireTargets(unit, target, units)) {
    actions.push({ unitId: unit.id, type: 'split_fire', targetId: secondary.id });
    applyCombatDamage(unit, secondary, Math.floor(unit.attack * multiplier), actions, createDamageContext(unit, units, actions, hazards, rng, false, false, allowsSplitFireMinimumDamage(unit)));
    applyOnHitStatuses(unit, secondary, actions);
    applyTargetMark(unit, secondary, actions);
    if (secondary.hp <= 0 && !secondary.isDead) handleDeath(secondary, unit, units, actions, hazards, rng);
  }
}

function processSideWeaponAttack(unit: SimUnit, target: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG): void {
  const damage = getSideWeaponDamage(unit);
  if (damage <= 0) return;

  for (const secondary of getSideWeaponTargets(unit, target, units)) {
    actions.push({ unitId: unit.id, type: 'side_weapon_attack', targetId: secondary.id });
    applyCombatDamage(unit, secondary, damage, actions, createDamageContext(unit, units, actions, hazards, rng, false, false));
    if (secondary.hp <= 0 && !secondary.isDead) handleDeath(secondary, unit, units, actions, hazards, rng);
  }
}

function applySecondaryWeaponTargets(unit: SimUnit, targets: SimUnit[], multiplier: number, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG, interceptable = false): void {
  for (const secondary of targets) {
    const result = applyCombatDamage(unit, secondary, Math.floor(unit.attack * multiplier), actions, createDamageContext(unit, units, actions, hazards, rng, false, interceptable));
    if (result.intercepted) continue;
    applyOnHitStatuses(unit, secondary, actions);
    applyTargetMark(unit, secondary, actions);
    if (secondary.hp <= 0 && !secondary.isDead) handleDeath(secondary, unit, units, actions, hazards, rng);
  }
}

function createDamageContext(unit: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG, allowPercentHpDamage = true, interceptable = false, allowMinimumDamage = true) {
  return { units, hazards, allowPercentHpDamage, interceptable, allowMinimumDamage, onUnitDeath: (target: SimUnit) => handleDeath(target, unit, units, actions, hazards, rng) };
}

function createTriggerContext(unit: SimUnit, units: SimUnit[], actions: BattleAction[], hazards: SimHazard[], rng: PRNG, tick: number) {
  return { units, hazards, actions, rng, tick, onUnitDeath: (target: SimUnit, source: SimUnit) => handleDeath(target, source ?? unit, units, actions, hazards, rng) };
}

function tickTemporaryUnit(unit: SimUnit, actions: BattleAction[]): void {
  if (!unit.isTemporary || unit.temporaryDuration === undefined || unit.isDead) return;
  unit.temporaryDuration--;
  if (unit.temporaryDuration > 0) return;

  unit.isDead = true;
  actions.push({ unitId: unit.id, type: 'die' });
}

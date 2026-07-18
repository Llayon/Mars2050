import type { BattleAction } from '../../combat.actions'
import type { PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { breakEcsMovementStealthOnAttack } from '../movement-state'
import { consumeEcsAttackCharge } from './attack-charge-system'
import { applyEcsBarrageAttack } from './barrage-attack-system'
import { applyEcsChainAttack } from './chain-attack-system'
import { applyEcsConditionalAttack } from './conditional-attack-system'
import { applyEcsSingleDamage } from './damage-system'
import { resolveSimpleEcsDeath } from './death-system'
import { applyEcsDirectionalGeometry } from './directional-geometry-system'
import { applyEcsDisplacement } from './displacement-system'
import { consumeEcsEmergeStrike } from './emerge-strike-system'
import { applyEcsOnHitEffects } from './on-hit-system'
import { applyEcsPrimaryDamageModifiers } from './primary-damage-modifier-system'
import { spawnEcsAttackPuddle } from './puddle-system'
import { applyEcsRadialAoe } from './radial-aoe-system'
import { applyEcsSideWeapon } from './side-weapon-system'
import { applyEcsSplitFire } from './split-fire-system'
import { applyEcsSweepAttack } from './sweep-attack-system'

export function resolveEcsSingleShot(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  tick: number,
  rng: PRNG,
): void {
  const identity = world.stores.identity.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  actions.push({
    unitId: identity.id,
    type: 'attack',
    targetId: world.stores.identity.require(targetId).id,
  })
  const emergeStrike = consumeEcsEmergeStrike(world, entityId)
  let primaryDamage = applyEcsPrimaryDamageModifiers(
    world,
    entityId,
    targetId,
    combat.attack,
    actions,
  )
  if (emergeStrike?.attackMult) {
    primaryDamage = Math.floor(primaryDamage * emergeStrike.attackMult)
  }
  primaryDamage = consumeEcsAttackCharge(
    world,
    entityId,
    primaryDamage,
    actions,
    tick,
  )
  const damageResult = applyEcsSingleDamage(
    world,
    entityId,
    targetId,
    primaryDamage,
    actions,
  )
  status.hasAttacked = true
  breakEcsMovementStealthOnAttack(world, entityId, actions)
  if (!damageResult.intercepted) {
    applyEcsOnHitEffects(world, entityId, targetId, actions)
    spawnEcsAttackPuddle(world, entityId, targetId, rng)
  }
  resolveSimpleEcsDeath(world, targetId, entityId, actions)
  if (damageResult.intercepted) return
  applyEcsDirectionalGeometry(world, entityId, targetId, actions)
  applyEcsBarrageAttack(world, entityId, targetId, actions)
  applyEcsChainAttack(world, entityId, targetId, actions)
  applyEcsSplitFire(world, entityId, targetId, actions)
  applyEcsSideWeapon(world, entityId, targetId, actions)
  applyEcsConditionalAttack(world, entityId, targetId, actions)
  applyEcsSweepAttack(world, entityId, targetId, actions)
  applyEcsRadialAoe(
    world,
    entityId,
    targetId,
    actions,
    emergeStrike?.aoeRadiusAdd,
  )
  applyEcsDisplacement(world, entityId, targetId, actions)
}

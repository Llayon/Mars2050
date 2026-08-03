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
import { resolveEcsDeath } from './death-system'
import { applyEcsDirectionalGeometry } from './directional-geometry-system'
import { applyEcsDisplacement } from './displacement-system'
import { consumeEcsEmergeStrike } from './emerge-strike-system'
import { applyEcsOnHitEffects } from './on-hit-system'
import {
  recordEcsAttackTriggers,
  recordEcsDamageTakenTriggers,
} from './post-hit-trigger-system'
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
  const weapon = world.stores.weapon.require(entityId)
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
    { interceptable: !weapon.selfDestructOnAttack },
  )
  status.hasAttacked = true
  breakEcsMovementStealthOnAttack(world, entityId, actions)
  if (!damageResult.intercepted) {
    recordEcsAttackTriggers(world, entityId, targetId, actions)
    recordEcsDamageTakenTriggers(
      world,
      entityId,
      targetId,
      damageResult.damage + damageResult.sharedDamage,
      actions,
    )
    applyEcsOnHitEffects(world, entityId, targetId, actions)
    spawnEcsAttackPuddle(world, entityId, targetId, rng)
  }
  resolveEcsDeath(world, targetId, entityId, actions)
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
  if (weapon.selfDestructOnAttack) {
    actions.push({
      unitId: identity.id,
      type: 'self_destruct',
      targetId: world.stores.identity.require(targetId).id,
      radius: weapon.aoeRadius,
    })
    world.stores.vitality.require(entityId).hp = 0
    resolveEcsDeath(world, entityId, undefined, actions, 'self_destruct')
  }
}

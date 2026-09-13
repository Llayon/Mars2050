import type { BattleAction } from '../../combat.actions.js'
import type { PRNG } from '../../combat.utils.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { breakEcsMovementStealthOnAttack } from '../movement-state.js'
import { consumeEcsAttackCharge } from './attack-charge-system.js'
import { applyEcsSingleDamage } from './damage-system.js'
import { resolveEcsDeath } from './death-system.js'
import { consumeEcsEmergeStrike } from './emerge-strike-system.js'
import { applyEcsOnHitEffects } from './on-hit-system.js'
import {
  recordEcsAttackTriggers,
  recordEcsDamageTakenTriggers,
} from './post-hit-trigger-system.js'
import { applyEcsPrimaryDamageModifiers } from './primary-damage-modifier-system.js'
import { spawnEcsAttackPuddle } from './puddle-system.js'
import { hasCompiledAbilityTrigger, runCompiledAbilityTrigger } from './ability-effect-system.js'
import { runLegacyGeometryEffects } from './legacy-geometry-system.js'

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
    { interceptable: !weapon.selfDestructOnAttack, originExternalId: `unit:${identity.id}:attack`, authoredOrdinal: 0, authoredPosition: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 } },
  )
  status.hasAttacked = true
  breakEcsMovementStealthOnAttack(world, entityId, actions)
  if (!damageResult.intercepted) {
    recordEcsAttackTriggers(world, entityId, targetId, actions)
    if (world.resources.get('defenseResolutionMode') !== 'v9_snapshot') {
      recordEcsDamageTakenTriggers(world, entityId, targetId, damageResult.damage + damageResult.sharedDamage, actions)
    }
    applyEcsOnHitEffects(world, entityId, targetId, actions, { authoredKey: { originExternalId: `unit:${identity.id}:attack`, position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, targetExternalId: world.stores.identity.require(targetId).id, sourceExternalId: identity.id } })
    spawnEcsAttackPuddle(world, entityId, targetId, rng)
  }
  resolveEcsDeath(world, targetId, entityId, actions)
  if (damageResult.intercepted) return
  if (hasCompiledAbilityTrigger(world, entityId, 'weapon_attack')) {
    runCompiledAbilityTrigger(world, entityId, targetId, 'weapon_attack', actions)
  } else {
    runLegacyGeometryEffects(world, entityId, targetId, actions, emergeStrike?.aoeRadiusAdd)
  }
  if (hasCompiledAbilityTrigger(world, entityId, 'post_weapon_attack')) {
    runCompiledAbilityTrigger(world, entityId, targetId, 'post_weapon_attack', actions)
  }
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

import type { BattleAction } from '../../combat.actions.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { applyEcsBarrageAttack } from './barrage-attack-system.js'
import { applyEcsChainAttack } from './chain-attack-system.js'
import { applyEcsConditionalAttack } from './conditional-attack-system.js'
import { applyEcsDirectionalGeometry } from './directional-geometry-system.js'
import { applyEcsDisplacement } from './displacement-system.js'
import { applyEcsRadialAoe } from './radial-aoe-system.js'
import { applyEcsSideWeapon } from './side-weapon-system.js'
import { applyEcsSplitFire } from './split-fire-system.js'
import { applyEcsSweepAttack } from './sweep-attack-system.js'

export function runLegacyGeometryEffects(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  aoeRadiusAdd?: number,
): void {
  applyEcsDirectionalGeometry(world, attackerId, targetId, actions)
  applyEcsBarrageAttack(world, attackerId, targetId, actions)
  applyEcsChainAttack(world, attackerId, targetId, actions)
  applyEcsSplitFire(world, attackerId, targetId, actions)
  applyEcsSideWeapon(world, attackerId, targetId, actions)
  applyEcsConditionalAttack(world, attackerId, targetId, actions)
  applyEcsSweepAttack(world, attackerId, targetId, actions)
  applyEcsRadialAoe(world, attackerId, targetId, actions, aoeRadiusAdd)
  applyEcsDisplacement(world, attackerId, targetId, actions)
}

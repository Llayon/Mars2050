import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsBarrageAttack } from './barrage-attack-system'
import { applyEcsChainAttack } from './chain-attack-system'
import { applyEcsConditionalAttack } from './conditional-attack-system'
import { applyEcsDirectionalGeometry } from './directional-geometry-system'
import { applyEcsDisplacement } from './displacement-system'
import { applyEcsRadialAoe } from './radial-aoe-system'
import { applyEcsSideWeapon } from './side-weapon-system'
import { applyEcsSplitFire } from './split-fire-system'
import { applyEcsSweepAttack } from './sweep-attack-system'

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

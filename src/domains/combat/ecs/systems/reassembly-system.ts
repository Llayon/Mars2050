import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import { cancelTemporalTimeline } from './temporal-attack-system'

export function runEcsReassemblySystem(
  world: CombatWorld,
  actions: BattleAction[],
): void {
  const waiting = world.query(['identity', 'vitality', 'reassemblyCapability'], true)
    .filter(entityId => world.stores.vitality.require(entityId).reassemblyState)
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )

  for (const entityId of waiting) {
    const vitality = world.stores.vitality.require(entityId)
    const state = vitality.reassemblyState
    if (!state) continue
    const timeline = world.resources.get('temporalAttacks')?.get(entityId)
    if (timeline) cancelTemporalTimeline(world, entityId, timeline, actions, 'source_reassembled')
    state.remainingTicks--
    if (state.remainingTicks > 0) continue

    const hp = Math.max(1, Math.floor(vitality.maxHp * state.hpPercent))
    const identity = world.stores.identity.require(entityId)
    const combat = world.stores.combat.require(entityId)
    const status = world.stores.statusControl.require(entityId)
    const targeting = world.stores.targeting.require(entityId)
    vitality.hp = hp
    world.setEntityDead(entityId, false)
    vitality.reassemblyState = undefined
    world.setUnitCapability(entityId, 'reassemblyCapability', false)
    combat.actionCooldown = 0
    status.statusEffects = []
    world.sourceRefs.clearAll(world, entityId)
    world.setUnitCapability(entityId, 'activeStatusCapability', false)
    status.targetMark = undefined
    world.stores.entitySources.require(entityId).targetMarkSource = undefined
    targeting.controlProgress = undefined
    world.stores.entitySources.require(entityId).controlProgressSource = undefined
    actions.push({
      unitId: identity.id,
      type: 'reassembly_complete',
      targetId: identity.id,
      damage: hp,
    })
  }
}

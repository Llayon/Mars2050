import type { BattleAction } from '../../combat.actions'
import type { TriggerPayload } from '../../combat.sim.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

type ReassemblyPayload = Extract<TriggerPayload, { kind: 'delayed_reassembly' }>

export function startEcsTriggerReassembly(
  world: CombatWorld,
  ownerId: EntityId,
  targetId: EntityId,
  payload: ReassemblyPayload,
  actions: BattleAction[],
): boolean {
  const vitality = world.stores.vitality.require(targetId)
  if (vitality.reassemblyState || (vitality.reassemblyTriggersUsed ?? 0) >= 1) {
    return false
  }

  vitality.reassemblyTriggersUsed = (vitality.reassemblyTriggersUsed ?? 0) + 1
  vitality.reassemblyState = {
    remainingTicks: Math.max(0, Math.floor(payload.delayTicks)),
    hpPercent: Math.max(0.01, Math.min(1, payload.hpPercent ?? 1)),
    sourceUnitId: world.stores.identity.require(ownerId).id,
  }
  world.setUnitCapability(targetId, 'reassemblyCapability', true)
  const target = world.stores.identity.require(targetId).id
  actions.push({
    unitId: target,
    type: 'reassembly_start',
    targetId: target,
    value: vitality.reassemblyState.remainingTicks,
  })
  return true
}

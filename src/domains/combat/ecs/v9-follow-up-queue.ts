import type { RuntimePhaseContext } from '../combat.phase'
import { EcsActionGroupLedger } from '../combat.action-intent'
import type { CombatWorld } from './combat-world'
import { commitV9ResolutionGroup } from './v9-defense-commit'
import { applyEcsTriggerPayload } from './systems/trigger-payload-system'
import { CombatInvariantError, compareDamageOrder } from './defense-batch'

const MAX_FOLLOW_UP_DEPTH = 32

export function drainV9FollowUps(world: CombatWorld, context: RuntimePhaseContext): void {
  if (world.resources.get('defenseResolutionMode') !== 'v9_snapshot') return
  const queue = world.resources.require('v9FollowUps')
  while (queue.length > 0) {
    queue.sort((left, right) => compareDamageOrder(left.order, right.order) || left.followUpOrdinal - right.followUpOrdinal)
    const job = queue.shift()!
    if (job.chainPath.length > MAX_FOLLOW_UP_DEPTH) {
      throw new CombatInvariantError(`V9 follow-up trigger depth exceeded ${MAX_FOLLOW_UP_DEPTH}; chain=${job.chainPath.join(' > ')}`)
    }
    const resolvedOwnerId = world.getEntityId(job.ownerExternalId)
    const ownerId = resolvedOwnerId !== undefined && !world.stores.vitality.require(resolvedOwnerId).isDead
      ? resolvedOwnerId
      : undefined
    const targetId = job.targetExternalId === undefined ? null : world.getEntityId(job.targetExternalId) ?? null
    const eventTargetId = world.getEntityId(job.eventTargetExternalId)
    const ledger = new EcsActionGroupLedger()
    const previous = world.resources.get('actionGroup')
    const previousChainPath = world.resources.get('v9FollowUpChainPath')
    world.resources.set('actionGroup', ledger)
    world.resources.set('v9FollowUpChainPath', job.chainPath)
    try {
      ledger.begin(world, world.query(['identity', 'vitality']), {
        tick: context.tick,
        phaseId: 'trigger_follow_up',
        groupOrdinal: job.followUpOrdinal,
      })
      applyEcsTriggerPayload(world, ownerId, targetId !== null && !world.stores.vitality.require(targetId).isDead ? targetId : null, eventTargetId, job.payload, job.actions, job.order, job.attribution, job.capturedSource)
      commitV9ResolutionGroup(world, ledger, job.actions)
    } finally {
      world.resources.set('actionGroup', previous)
      world.resources.set('v9FollowUpChainPath', previousChainPath)
    }
    world.flushStructuralCommands()
  }
}

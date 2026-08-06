import type { RuntimePhaseContext } from '../combat.phase'
import { EcsActionGroupLedger } from '../combat.action-intent'
import type { CombatWorld } from './combat-world'
import { commitV9ResolutionGroup } from './v9-defense-commit'
import { applyEcsTriggerPayload } from './systems/trigger-payload-system'
import { compareDamageOrder } from './defense-batch'

const MAX_FOLLOW_UP_DEPTH = 32

export function drainV9FollowUps(world: CombatWorld, context: RuntimePhaseContext): void {
  if (world.resources.get('defenseResolutionMode') !== 'v9_snapshot') return
  const queue = world.resources.require('v9FollowUps')
  let depth = 0
  while (queue.length > 0) {
    queue.sort((left, right) => compareDamageOrder(left.order, right.order) || left.followUpOrdinal - right.followUpOrdinal)
    if (depth++ >= MAX_FOLLOW_UP_DEPTH) {
      const path = queue.map(job => job.chainPath.join(' > ')).join(' | ')
      throw new Error(`V9 follow-up trigger depth exceeded ${MAX_FOLLOW_UP_DEPTH}; chain=${path}`)
    }
    const job = queue.shift()!
    const ledger = new EcsActionGroupLedger()
    const previous = world.resources.get('actionGroup')
    world.resources.set('actionGroup', ledger)
    try {
      ledger.begin(world, world.query(['identity', 'vitality']), {
        tick: context.tick,
        phaseId: 'trigger_follow_up',
        groupOrdinal: depth,
      })
      applyEcsTriggerPayload(world, job.ownerId, job.targetId, job.eventTargetId, job.payload, job.actions, job.order)
      commitV9ResolutionGroup(world, ledger, job.actions)
    } finally {
      world.resources.set('actionGroup', previous)
    }
    world.flushStructuralCommands()
  }
}

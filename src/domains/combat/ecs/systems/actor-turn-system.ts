import type { RuntimePhaseContext } from '../../combat.phase'
import type { EcsActionIntent, EcsActionKind } from '../../combat.action-intent'
import { EcsActionGroupLedger } from '../../combat.action-intent'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { MovementRequest } from '../movement-batch.types'
import {
  createEcsMeleeEngagementState,
  reserveEcsMeleeSlot,
} from './melee-engagement-system'
import { getEcsInitiativeGroups } from './initiative-system'
import { runActionSystem } from './action-system'
import { resolveEcsDeath } from './death-system'
import { runModifierSystem } from './modifier-system'
import { runEcsPeriodicSpawnerSystem } from './periodic-spawner-system'
import { runTargetingSystem } from './targeting-system'
import { applyEcsStatus } from './status-application-system'
import { commitV9ResolutionGroup } from '../v9-defense-commit'

export function runEcsActorTurnSystem(
  world: CombatWorld,
  context: RuntimePhaseContext,
): void {
  const rng = context.rng ?? world.resources.require('rng')
  const movementRequests: MovementRequest[] = []
  world.resources.set('movementRequests', movementRequests)
  world.flushStructuralCommands()
  world.resources.require('entitySpatial').ensureCurrent(world)
  const melee = createEcsMeleeEngagementState()
  const targeting = world.resources.require('targetingRuntime')
  const ledger = world.resources.get('actionGroup') ?? new EcsActionGroupLedger()
  world.resources.set('actionGroup', ledger)

  const allActors = [...world.query(['identity', 'vitality', 'combat'])]
    .sort((left, right) => world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id))
  for (const entityId of allActors) {
      if (world.stores.vitality.require(entityId).isDead) continue
      runModifierSystem(world, entityId, context.actions, expiredId => {
        resolveEcsDeath(world, expiredId, undefined, context.actions, 'expiration')
      })
  }
  world.flushStructuralCommands()
  targeting.begin(world)

  try {
    let initiativeIndex = 0
    for (const group of getEcsInitiativeGroups(world)) {
      ledger.begin(world, world.query(['identity', 'vitality']), {
        tick: context.tick,
        phaseId: 'actor_turn',
        groupOrdinal: initiativeIndex,
      })
      const intents: EcsActionIntent[] = []
      const groupMovement: MovementRequest[] = []
      for (const entityId of group.entityIds) {
        if (world.stores.vitality.require(entityId).isDead) continue
        const timeline = world.resources.require('temporalAttacks').get(entityId)
        if (timeline) {
          const target = world.stores.transform.get(timeline.targetId)
          const aim = timeline.positionPolicy === 'captured_at_windup'
            ? { x: timeline.aimX, y: timeline.aimY }
            : target && !world.stores.vitality.require(timeline.targetId).isDead
              ? { x: target.x, y: target.y }
              : { x: timeline.aimX, y: timeline.aimY }
          groupMovement.push({
            kind: 'turn',
            entityId,
            targetX: aim.x,
            targetY: aim.y,
            initiativeIndex: initiativeIndex++,
          })
          continue
        }
        const targetId = runTargetingSystem(world, entityId, melee, targeting)
        if (targetId === null) continue
        const canAct = canActOnTarget(world, entityId, targetId)
        const engaged = canAct ? reserveEcsMeleeSlot(world, entityId, targetId, melee) : true
        if (!canAct || !engaged) {
          groupMovement.push({ kind: 'move', entityId, targetId, initiativeIndex: initiativeIndex++ })
          continue
        }
        const actor = world.stores.identity.require(entityId)
        const target = world.stores.identity.require(targetId)
        intents.push({
          actorId: entityId,
          targetId,
          initiative: group.speed,
          actorExternalId: actor.id,
          targetExternalId: target.id,
          team: actor.team,
          kind: getActionKind(world, entityId),
          sequence: intents.length,
        })
      }

      for (const intent of intents.sort(compareIntents)) {
        if (world.stores.periodicSpawnerCapability.has(intent.actorId)) {
          runEcsPeriodicSpawnerSystem(world, intent.actorId, intent.targetId, context.actions, {
            rng, tick: context.tick,
          })
        }
        const acted = runActionSystem(
          world,
          intent.actorId,
          intent.targetId,
          context.actions,
          { rng, tick: context.tick, allowDeadActorAction: true },
        ).acted
        if (!acted) groupMovement.push({
          kind: 'move',
          entityId: intent.actorId,
          targetId: intent.targetId,
          initiativeIndex: initiativeIndex++,
        })
      }
      movementRequests.push(...groupMovement)
      commitActionGroup(world, ledger, context.actions)
      world.flushStructuralCommands()
      initiativeIndex += group.entityIds.length
    }
  } finally {
    targeting.end()
  }
}

export function commitActionGroup(
  world: CombatWorld,
  ledger: EcsActionGroupLedger,
  actions: RuntimePhaseContext['actions'],
): void {
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot') {
    commitV9ResolutionGroup(world, ledger, actions)
    return
  }
  if (world.resources.get('defenseResolutionMode') === 'v9_snapshot') ledger.assertRoutingIntact(world)
  const affected = new Set([...ledger.damage.keys(), ...ledger.healing.keys()])
  for (const entityId of affected) {
    const vitality = world.stores.vitality.require(entityId)
    const startHp = ledger.startHp.get(entityId) ?? vitality.hp
    const healing = (ledger.healing.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
    const damage = (ledger.damage.get(entityId) ?? []).reduce((sum, item) => sum + item.amount, 0)
    vitality.hp = Math.max(0, Math.min(vitality.maxHp, startHp + healing - damage))
    emitGroupHealing(world, entityId, ledger, actions, damage)
  }
  ledger.committing = true
  for (const pending of ledger.statuses
    .sort((left, right) => world.stores.identity.require(left.targetId).id.localeCompare(world.stores.identity.require(right.targetId).id))) {
    const pendingVitality = world.stores.vitality.require(pending.targetId)
    if (!pendingVitality.isDead && (world.resources.get('defenseResolutionMode') !== 'v9_snapshot' || pendingVitality.hp > 0)) {
      applyEcsStatus(world, pending.targetId, pending.effect, actions)
    }
  }
  ledger.committing = false
  ledger.finish()
  const forcedEntries = [...ledger.forcedDeaths.entries()]
  for (const [entityId] of forcedEntries) {
    world.stores.vitality.require(entityId).hp = 0
    affected.add(entityId)
  }
  const deaths = [...affected]
    .filter(entityId => !world.stores.vitality.require(entityId).isDead && world.stores.vitality.require(entityId).hp <= 0)
    .sort((left, right) => world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id))
  const deathIds = new Set([...forcedEntries.map(([entityId]) => entityId), ...deaths])
  for (const entityId of deathIds) {
    if (!world.stores.vitality.require(entityId).isDead) world.setEntityDead(entityId, true)
  }
  for (const [entityId, forced] of forcedEntries) {
    resolveEcsDeath(world, entityId, forced.source, actions, forced.cause, { preMarked: true })
  }
  for (const entityId of deaths) {
    const vitality = world.stores.vitality.require(entityId)
      const pendingAttribution = (ledger.damage.get(entityId) ?? [])
        .sort((left, right) => right.amount - left.amount ||
          left.attribution.sourceExternalId.localeCompare(right.attribution.sourceExternalId))[0]?.attribution
      const attribution = pendingAttribution && (pendingAttribution.sourceEntityId !== undefined || pendingAttribution.sourceUnitType || pendingAttribution.sourceTeam) ? pendingAttribution : undefined
      const cause = (ledger.damage.get(entityId) ?? []).sort((left, right) => right.amount - left.amount || left.attribution.sourceExternalId.localeCompare(right.attribution.sourceExternalId))[0]?.cause ?? 'weapon'
      resolveEcsDeath(world, entityId, attribution, actions, cause, { preMarked: true })
    vitality.hp = 0
  }
}

function emitGroupHealing(
  world: CombatWorld,
  targetId: EntityId,
  ledger: EcsActionGroupLedger,
  actions: RuntimePhaseContext['actions'],
  damage: number,
): void {
  const entries = [...(ledger.healing.get(targetId) ?? [])]
  if (entries.length === 0) return
  const vitality = world.stores.vitality.require(targetId)
  const startHp = ledger.startHp.get(targetId) ?? vitality.hp
  let remaining = Math.max(0, Math.min(
    entries.reduce((sum, entry) => sum + entry.amount, 0),
    vitality.maxHp - startHp + damage,
  ))
  for (const entry of entries.sort((left, right) => left.sourceExternalId.localeCompare(right.sourceExternalId))) {
    const actual = Math.min(remaining, entry.amount)
    if (actual > 0) actions.push({
      unitId: entry.sourceExternalId,
      type: 'heal',
      targetId: world.stores.identity.require(targetId).id,
      damage: actual,
    })
    remaining -= actual
  }
}

function getActionKind(world: CombatWorld, entityId: EntityId): EcsActionKind {
  const weapon = world.stores.weapon.require(entityId)
  if (weapon.attackType === 'heal') return 'heal'
  if (weapon.attackType === 'spawn') return 'spawn'
  if (world.stores.runtimeRules.require(entityId).mineOnAction) return 'mine'
  if (weapon.smokeOnAction) return 'smoke'
  return 'weapon'
}

function compareIntents(left: EcsActionIntent, right: EcsActionIntent): number {
  return left.kind.localeCompare(right.kind) ||
    left.actorExternalId.localeCompare(right.actorExternalId) ||
    left.targetExternalId.localeCompare(right.targetExternalId) ||
    left.sequence - right.sequence
}

function canActOnTarget(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const source = world.stores.identity.require(entityId)
  const target = world.stores.identity.require(targetId)
  if (source.team !== target.team) return true
  if (world.stores.weapon.require(entityId).attackType === 'heal') return true
  return world.stores.statusControl.require(entityId).statusEffects.some(effect =>
    effect.type === 'hacked' && effect.duration > 0 &&
    (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'),
  )
}

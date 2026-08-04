import type { BattleAction } from '../../combat.actions'
import type { RuntimePeriodicAbility } from '../../combat.sim.types'
import type { CompiledAbilityProgram } from '../../combat.ability-compiler'
import type { PeriodicAbilityPayload } from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsPeriodicAbilityPayload } from './periodic-ability-payload-system'
import { getAbilityExecutionMode } from './ability-effect-system'

export function getEcsPeriodicAbilityEntities(world: CombatWorld): readonly EntityId[] {
  return world.query([
    'identity',
    'transform',
    'vitality',
    'combat',
    'targeting',
    'support',
    'periodicAbilityCapability',
  ])
}

export function runEcsPeriodicAbilitySystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsPeriodicAbilityEntities(world),
): void {
  const sources = [...entityIds].sort((left, right) =>
    getExternalId(world, left).localeCompare(getExternalId(world, right)),
  )
  for (const sourceId of sources) {
    if (world.stores.vitality.require(sourceId).isDead) continue
    const support = world.stores.support.require(sourceId)
    for (const entry of getPeriodicEntries(world, sourceId)) {
      const { ability, payload } = entry
      if (!canUseAbility(tick, ability)) continue
      const targetId = selectTarget(world, sourceId, ability)
      if (targetId === null) continue
      ability.chargesRemaining = ability.chargesRemaining === undefined
        ? undefined
        : ability.chargesRemaining - 1
      ability.nextTick = tick + Math.max(1, ability.intervalTicks)
      actions.push({
        unitId: getExternalId(world, sourceId),
        type: 'periodic_ability',
        targetId: getExternalId(world, targetId),
        statusType: ability.id,
      })
      applyEcsPeriodicAbilityPayload(
        world,
        sourceId,
        targetId,
        payload,
        ability.id,
        tick,
        actions,
      )
    }
  }
}

interface PeriodicEntry {
  ability: RuntimePeriodicAbility
  payload: PeriodicAbilityPayload
}

function getPeriodicEntries(world: CombatWorld, sourceId: EntityId): PeriodicEntry[] {
  const support = world.stores.support.require(sourceId)
  const compiled = getAbilityExecutionMode(world, sourceId) === 'compiled'
  if (!compiled || (support.periodicPrograms?.length ?? 0) === 0) {
    return (support.periodicAbilities ?? []).map(ability => ({ ability, payload: ability.payload }))
  }
  const state = support.periodicProgramState ?? []
  return state.flatMap(ability => {
    const program = (support.periodicPrograms ?? []).find(candidate =>
      candidate.groups.some(group => group.effects.some(effect =>
        effect.kind === 'periodic_payload' && effect.ability.id === ability.id,
      )),
    )
    const payload = getProgramPayload(program)
    return payload ? [{ ability, payload }] : []
  })
}

function getProgramPayload(program: CompiledAbilityProgram | undefined): PeriodicAbilityPayload | undefined {
  for (const group of program?.groups ?? []) {
    for (const effect of group.effects) {
      if (effect.kind === 'periodic_payload') return effect.ability.payload
    }
  }
  return undefined
}

function canUseAbility(
  tick: number,
  ability: RuntimePeriodicAbility,
): boolean {
  return tick >= ability.nextTick &&
    (ability.chargesRemaining === undefined || ability.chargesRemaining > 0)
}

function selectTarget(
  world: CombatWorld,
  sourceId: EntityId,
  ability: RuntimePeriodicAbility,
): EntityId | null {
  const policy = ability.targetPolicy ?? 'current_target'
  if (policy === 'self') return sourceId
  if (policy === 'ally_lowest_hp') {
    return selectLowestHpAlly(world, sourceId, ability)
  }
  const currentId = world.stores.entityTargets.require(sourceId).attackTarget
  if (policy === 'current_target' &&
      currentId !== undefined &&
      isEnemyTarget(world, sourceId, currentId, ability) &&
      isWithinRange(world, sourceId, currentId, ability)) return currentId
  const candidates = getRangeCandidates(world, sourceId, ability)
    .filter(targetId =>
      isEnemyTarget(world, sourceId, targetId, ability) &&
      matchesPolicy(world, targetId, policy),
    )
  return selectNearest(world, sourceId, candidates)
}

function selectLowestHpAlly(
  world: CombatWorld,
  sourceId: EntityId,
  ability: RuntimePeriodicAbility,
): EntityId | null {
  const sourceTeam = world.stores.identity.require(sourceId).team
  return getRangeCandidates(world, sourceId, ability)
    .filter(entityId => {
      if (entityId === sourceId) return false
      const identity = world.stores.identity.require(entityId)
      const vitality = world.stores.vitality.require(entityId)
      return identity.team === sourceTeam && vitality.hp < vitality.maxHp
    })
    .sort((left, right) => {
      const leftVitality = world.stores.vitality.require(left)
      const rightVitality = world.stores.vitality.require(right)
      const ratio = leftVitality.hp / leftVitality.maxHp -
        rightVitality.hp / rightVitality.maxHp
      return ratio !== 0
        ? ratio
        : getExternalId(world, left).localeCompare(getExternalId(world, right))
    })[0] ?? null
}

function getRangeCandidates(
  world: CombatWorld,
  sourceId: EntityId,
  ability: RuntimePeriodicAbility,
): EntityId[] {
  const source = world.stores.transform.require(sourceId)
  if (ability.maxRange !== undefined) {
    return world.resources.require('entitySpatial')
      .query(world, source.x, source.y, ability.maxRange)
      .filter(entityId => isWithinRange(world, sourceId, entityId, ability))
  }
  return world.query(['identity', 'transform', 'vitality'])
    .filter(entityId => isWithinRange(world, sourceId, entityId, ability))
}

function isEnemyTarget(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  ability: RuntimePeriodicAbility,
): boolean {
  const source = world.stores.identity.require(sourceId)
  const target = world.stores.identity.require(targetId)
  const targetTransform = world.stores.transform.require(targetId)
  if (world.stores.vitality.require(targetId).isDead ||
      target.team === source.team) return false
  return !targetTransform.isFlying ||
    ability.canTargetAir === true ||
    world.stores.combat.require(sourceId).canTargetAir
}

function matchesPolicy(
  world: CombatWorld,
  targetId: EntityId,
  policy: RuntimePeriodicAbility['targetPolicy'],
): boolean {
  const flying = world.stores.transform.require(targetId).isFlying
  if (policy === 'nearest_air') return flying
  if (policy === 'nearest_ground') return !flying
  return true
}

function isWithinRange(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  ability: RuntimePeriodicAbility,
): boolean {
  const distance = getEntityDistance(world, sourceId, targetId)
  if (ability.minRange !== undefined && distance < ability.minRange) return false
  return ability.maxRange === undefined || distance <= ability.maxRange
}

function selectNearest(
  world: CombatWorld,
  sourceId: EntityId,
  candidates: EntityId[],
): EntityId | null {
  return candidates.sort((left, right) => {
    const distance = getEntityDistance(world, sourceId, left) -
      getEntityDistance(world, sourceId, right)
    return distance !== 0
      ? distance
      : getExternalId(world, left).localeCompare(getExternalId(world, right))
  })[0] ?? null
}

function getEntityDistance(
  world: CombatWorld,
  leftId: EntityId,
  rightId: EntityId,
): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.identity.require(entityId).id
}

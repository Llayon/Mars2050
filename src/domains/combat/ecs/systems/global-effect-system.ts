import type { BattleAction } from '../../combat.actions'
import type { ActiveGlobalEffect, ScheduledGlobalEffectKind, Team } from '../../combat.primitives'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealingFromSource } from './healing-system'
import { applyEcsStatus } from './status-application-system'
import { increaseShieldCapacity } from '../defense-resource-commit'

export type ActiveGlobal = ActiveGlobalEffect | { team: Team; upg: { id?: string; type: ScheduledGlobalEffectKind; value: number; tick?: number; target?: 'allies' | 'enemies' | 'center' } }

function resolveEffect(item: ActiveGlobal): { id?: string; type: ScheduledGlobalEffectKind; value: number; tick?: number; target?: string } {
  return 'effect' in item ? item.effect : item.upg
}

export function hasEcsGlobalEffectAtTick(
  tick: number,
  activeGlobals: ActiveGlobal[],
): boolean {
  return activeGlobals.some(item => {
    const effect = resolveEffect(item)
    return (tick === 0 && effect.type === 'mass_shield') ||
      tick === (effect.tick ?? getTriggerTick(effect.type))
  })
}

export function runEcsGlobalEffectSystem(
  world: CombatWorld,
  tick: number,
  activeGlobals: ActiveGlobal[],
  actions: BattleAction[],
  rng: PRNG,
): void {
  if (tick === 0) applyMassShields(world, activeGlobals)
  for (const item of activeGlobals) {
    const effect = resolveEffect(item)
    const team = item.team
    if (tick !== (effect.tick ?? getTriggerTick(effect.type))) continue
    if (effect.type === 'orbital_strike') {
      createOrbitalStrike(world, team, effect.value, actions)
    } else if (effect.type === 'global_emp') {
      for (const targetId of getTeamEntities(world, oppositeTeam(team))) {
        applyEcsStatus(world, targetId, {
          type: 'emp',
          duration: effect.value,
          sourceUnitId: 'global_emp',
        }, actions)
      }
    } else if (effect.type === 'mass_heal') {
      for (const targetId of getTeamEntities(world, team)) {
        applyEcsHealingFromSource(
          world,
          'system',
          targetId,
          effect.value,
          actions,
        )
      }
    }
  }
}

function applyMassShields(
  world: CombatWorld,
  activeGlobals: ActiveGlobal[],
): void {
  for (const item of activeGlobals) {
    const effect = resolveEffect(item)
    if (effect.type !== 'mass_shield') continue
    for (const targetId of getTeamEntities(world, item.team)) {
      increaseShieldCapacity(world, targetId, effect.value)
    }
  }
}

function createOrbitalStrike(
  world: CombatWorld,
  team: Team,
  damage: number,
  actions: BattleAction[],
): void {
  const enemies = getTeamEntities(world, oppositeTeam(team))
  let x = FIELD_WIDTH / 2
  let y = FIELD_HEIGHT / 2
  if (enemies.length > 0) {
    x = 0
    y = 0
    for (const entityId of enemies) {
      const transform = world.stores.transform.require(entityId)
      x += transform.x
      y += transform.y
    }
    x /= enemies.length
    y /= enemies.length
  }
  world.queueHazardCreation({
    id: world.allocateExternalId('orb_strike'),
    team,
    type: 'napalm',
    x,
    y,
    radius: 200,
    duration: 5,
    damagePerTick: damage,
  })
  actions.push({
    unitId: 'system',
    type: 'hazard_spawn',
    toX: x,
    toY: y,
    radius: 200,
  })
}

function getTeamEntities(world: CombatWorld, team: Team): EntityId[] {
  return world.query(['identity', 'vitality'])
    .filter(entityId => world.stores.identity.require(entityId).team === team)
}

function getTriggerTick(type: ScheduledGlobalEffectKind): number {
  if (type === 'global_emp') return 50
  if (type === 'orbital_strike') return 100
  if (type === 'mass_heal') return 150
  return -1
}

function oppositeTeam(team: Team): Team {
  return team === 'attacker' ? 'defender' : 'attacker'
}

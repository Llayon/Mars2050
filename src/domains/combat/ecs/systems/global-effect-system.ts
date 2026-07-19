import type { BattleAction } from '../../combat.actions'
import type { Team } from '../../combat.sim.types'
import type { GlobalUpgradeConfig } from '../../combat.upgrades'
import { FIELD_HEIGHT, FIELD_WIDTH, type PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealingFromSource } from './healing-system'
import { applyEcsStatus } from './status-application-system'

export interface ActiveGlobal {
  team: Team
  upg: GlobalUpgradeConfig
}

export function hasEcsGlobalEffectAtTick(
  tick: number,
  activeGlobals: ActiveGlobal[],
): boolean {
  return activeGlobals.some(({ upg }) =>
    (tick === 0 && upg.type === 'mass_shield') ||
    tick === getTriggerTick(upg.type),
  )
}

export function runEcsGlobalEffectSystem(
  world: CombatWorld,
  tick: number,
  activeGlobals: ActiveGlobal[],
  actions: BattleAction[],
  rng: PRNG,
): void {
  if (tick === 0) applyMassShields(world, activeGlobals)
  for (const { team, upg } of activeGlobals) {
    if (tick !== getTriggerTick(upg.type)) continue
    if (upg.type === 'orbital_strike') {
      createOrbitalStrike(world, team, upg.value, actions, rng)
    } else if (upg.type === 'global_emp') {
      for (const targetId of getTeamEntities(world, oppositeTeam(team))) {
        applyEcsStatus(world, targetId, {
          type: 'emp',
          duration: upg.value,
          sourceUnitId: 'global_emp',
        }, actions)
      }
    } else if (upg.type === 'mass_heal') {
      for (const targetId of getTeamEntities(world, team)) {
        applyEcsHealingFromSource(
          world,
          'system',
          targetId,
          upg.value,
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
  for (const { team, upg } of activeGlobals) {
    if (upg.type !== 'mass_shield') continue
    for (const targetId of getTeamEntities(world, team)) {
      const vitality = world.stores.vitality.require(targetId)
      vitality.maxShield += upg.value
      vitality.shield += upg.value
    }
  }
}

function createOrbitalStrike(
  world: CombatWorld,
  team: Team,
  damage: number,
  actions: BattleAction[],
  rng: PRNG,
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
    id: `orb_strike_${Math.floor(rng.next() * 1000000)}`,
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

function getTriggerTick(type: GlobalUpgradeConfig['type']): number {
  if (type === 'global_emp') return 50
  if (type === 'orbital_strike') return 100
  if (type === 'mass_heal') return 150
  return -1
}

function oppositeTeam(team: Team): Team {
  return team === 'attacker' ? 'defender' : 'attacker'
}

import type { Team } from '../../combat.sim.types'
import type { BattleOutcome } from '../../combat.outcome'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function getEcsTerminalOutcome(
  world: CombatWorld,
): BattleOutcome | null {
  const pendingAttackers = hasPendingReassembly(world, 'attacker')
  const pendingDefenders = hasPendingReassembly(world, 'defender')
  const attackers = [...world.queryTeam('attacker', ['identity', 'vitality'])]
  const defenders = [...world.queryTeam('defender', ['identity', 'vitality'])]
  if (attackers.length === 0 && defenders.length === 0) return pendingAttackers || pendingDefenders ? null : { winner: 'draw', reason: 'mutual_elimination' }
  if (attackers.length === 0) return pendingAttackers ? null : { winner: 'defender', reason: 'elimination' }
  if (defenders.length === 0) return pendingDefenders ? null : { winner: 'attacker', reason: 'elimination' }
  if (pendingAttackers || pendingDefenders || hasActiveDamageHazard(world)) return null
  if (canTeamDealDamage(world, attackers, defenders) || canTeamDealDamage(world, defenders, attackers)) return null

  const attackerPower = getOffensivePower(world, attackers)
  const defenderPower = getOffensivePower(world, defenders)
  if (attackerPower === defenderPower) return { winner: 'draw', reason: 'stalemate' }
  return { winner: attackerPower > defenderPower ? 'attacker' : 'defender', reason: 'stalemate' }
}

function hasPendingReassembly(world: CombatWorld, team: Team): boolean {
  return world.queryTeam(team, ['identity', 'vitality'], true).some(entityId =>
    world.stores.vitality.require(entityId).reassemblyState !== undefined,
  )
}

function canTeamDealDamage(world: CombatWorld, allies: EntityId[], enemies: EntityId[]): boolean {
  return allies.some(entityId => {
    const combat = world.stores.combat.require(entityId)
    const weapon = world.stores.weapon.require(entityId)
    const targeting = world.stores.targeting.require(entityId)
    const support = world.stores.support.require(entityId)
    const lifecycle = world.stores.lifecycle.require(entityId)
    if (weapon.attackType === 'spawn' || lifecycle.spawnerConfig || support.periodicAbilities?.length || targeting.controlBeam) return true
    if (weapon.attackType === 'heal') return false
    const hasDamage = (combat.attack ?? 0) > 0 || weapon.statusOnHit?.some(status => ['burn', 'acid', 'degeneration'].includes(status.type))
    return Boolean(hasDamage) && enemies.some(enemyId => canTarget(world, entityId, enemyId))
  })
}

function canTarget(world: CombatWorld, attackerId: EntityId, targetId: EntityId): boolean {
  const attacker = world.stores.combat.require(attackerId)
  const target = world.stores.transform.require(targetId)
  return target.isFlying !== true || attacker.canTargetAir === true
}

function getOffensivePower(world: CombatWorld, entities: EntityId[]): number {
  return entities.reduce((total, entityId) => {
    const vitality = world.stores.vitality.require(entityId)
    const combat = world.stores.combat.require(entityId)
    const weapon = world.stores.weapon.require(entityId)
    if (weapon.attackType === 'heal') return total
    const healthRatio = (vitality.maxHp ?? 0) > 0 ? Math.max(0, (vitality.hp ?? 0) / vitality.maxHp!) : 0
    return total + (combat.attack ?? 0) * healthRatio / Math.max(1, combat.actionCooldownMax ?? 1)
  }, 0)
}

function hasActiveDamageHazard(world: CombatWorld): boolean {
  return world.query(['hazard']).some(entityId => {
    const hazard = world.stores.hazard.require(entityId)
    return hazard.duration > 0 && hazard.damagePerTick > 0
  })
}

import type { BattleAction } from './combat.actions'
import { applyHealing } from './combat.healing'
import { applyOnKillEffects } from './combat.on-kill'
import { startReassembly } from './combat.reassembly'
import type { SimHazard, SimUnit } from './combat.sim.types'
import { processDeathTriggers, processKillTriggers } from './combat.triggers'
import type { PRNG } from './combat.utils'
import { cloneRuntimeUnit } from './combat.unit-factory'

export const DEATH_CAUSES = ['weapon', 'burn', 'acid', 'degeneration', 'mine', 'hazard', 'trigger', 'expiration'] as const
export type DeathCause = typeof DEATH_CAUSES[number]

export interface DeathContext {
  units: SimUnit[]
  hazards: SimHazard[]
  actions: BattleAction[]
  rng: PRNG
}

export function resolveUnitDeath(
  target: SimUnit,
  source: SimUnit | undefined,
  cause: DeathCause,
  context: DeathContext,
): boolean {
  if (target.isDead) return false
  if (cause === 'expiration') return expireUnit(target, source, cause, context.actions)
  if (target.hp > 0) return false

  if (target.resurrectOnce) {
    target.resurrectOnce = false
    applyHealing(target.id, target, target.maxHp, context.actions)
    return false
  }

  if (target.reassemblyConfig) startReassembly(target, target.reassemblyConfig, target.id, context.actions)
  target.isDead = true
  context.actions.push(createDeathAction(target, source, cause))

  const actor = source ?? target
  const triggerContext = {
    ...context,
    onUnitDeath: (dead: SimUnit, killer: SimUnit) => resolveUnitDeath(dead, killer, 'trigger', context),
  }
  processDeathTriggers(target, actor, triggerContext)
  if (source && source.team !== target.team) {
    applyOnKillEffects(source, target, context.actions)
    processKillTriggers(source, target, triggerContext)
    replicateKiller(source, target, context)
  }
  spawnDeathHazard(target, context)
  return true
}

function expireUnit(target: SimUnit, source: SimUnit | undefined, cause: DeathCause, actions: BattleAction[]): boolean {
  target.isDead = true
  actions.push(createDeathAction(target, source, cause))
  return true
}

function createDeathAction(target: SimUnit, source: SimUnit | undefined, cause: DeathCause): BattleAction {
  return { unitId: target.id, type: 'die', sourceUnitId: source?.id, cause }
}

function spawnDeathHazard(target: SimUnit, context: DeathContext): void {
  if (!target.onDeathPuddle) return
  const hazard: SimHazard = {
    id: `hazard_${Math.floor(context.rng.next() * 1000000)}`,
    team: target.team,
    type: target.onDeathPuddle,
    x: target.x,
    y: target.y,
    radius: 50,
    damagePerTick: target.onDeathPuddle === 'acid' ? Math.floor(target.maxHp * 0.1) : 10,
    duration: 40,
    sourceUnitId: target.id,
  }
  context.hazards.push(hazard)
  context.actions.push({ unitId: target.id, type: 'hazard_spawn', hazardId: hazard.id, statusType: hazard.type, toX: hazard.x, toY: hazard.y, radius: hazard.radius })
}

function replicateKiller(source: SimUnit, target: SimUnit, context: DeathContext): void {
  if (!source.replicateOnKill) return
  const clone = cloneRuntimeUnit(source, `clone_${Math.floor(context.rng.next() * 1000000)}`, target.x, target.y)
  context.units.push(clone)
  context.actions.push({ unitId: source.id, type: 'spawn', toX: target.x, toY: target.y, spawnType: source.type, spawnTeam: source.team, spawnMaxHp: source.maxHp, targetId: clone.id })
}

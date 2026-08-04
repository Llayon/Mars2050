import type { BattleAction } from './combat.actions'
import type { SimUnit, Team } from './combat.sim.types'

export interface MarkCombatMetrics {
  firstMarkTick: number | null
  markUptimeTicks: number
  uniqueMarkedSquads: number
  designationSwitchCount: number
  markRefreshCount: number
  alliedShotsWhileMarkActive: number
  shotsAgainstMarkedTargets: number
  markUtilization: number
  damageAgainstMarkedTargets: number
  bonusDamageFromMarks: number
  alliesRetargetedByMark: number
  markedTargetOverkillDamage: number
}

interface MetricUnit {
  team: Team
  squadId: string
  attack: number
  hp: number
}

interface ActiveDesignation {
  team: Team
  squadId: string
  expiresAt: number
}

export class MarkMetricsAccumulator {
  private readonly units = new Map<string, MetricUnit>()
  private readonly active = new Map<string, ActiveDesignation>()
  private readonly uniqueSquads = new Set<string>()
  private readonly values: MarkCombatMetrics = emptyMarkCombatMetrics()

  constructor(units: SimUnit[]) {
    for (const unit of units) {
      this.units.set(unit.id, {
        team: unit.team,
        squadId: unit.squadId ?? unit.id,
        attack: unit.attack,
        hp: unit.hp,
      })
    }
  }

  consumeTick(tick: number, actions: BattleAction[]): void {
    this.expire(tick)
    for (const action of actions) this.consumeAction(tick, action)
    if (this.active.size > 0) this.values.markUptimeTicks++
  }

  snapshot(): MarkCombatMetrics {
    return {
      ...this.values,
      uniqueMarkedSquads: this.uniqueSquads.size,
      markUtilization: this.values.alliedShotsWhileMarkActive > 0
        ? this.values.shotsAgainstMarkedTargets /
          this.values.alliedShotsWhileMarkActive
        : 0,
    }
  }

  private consumeAction(tick: number, action: BattleAction): void {
    if (action.type === 'target_mark' && action.markSquadId) {
      this.recordMark(tick, action)
      return
    }
    if (action.type === 'attack') this.recordAttack(action)
    if (action.type === 'damage' || action.type === 'damage_share') {
      this.recordDamage(action)
    }
    if (action.type === 'die') {
      const unit = this.units.get(action.unitId)
      if (unit) unit.hp = 0
    }
  }

  private recordMark(tick: number, action: BattleAction): void {
    const source = this.units.get(action.unitId)
    if (!source || !action.markSquadId) return
    if (this.values.firstMarkTick === null) this.values.firstMarkTick = tick
    if (action.markEvent === 'refresh') this.values.markRefreshCount++
    if (action.markEvent === 'new_squad' && this.active.has(action.unitId)) {
      this.values.designationSwitchCount++
    }
    this.values.alliesRetargetedByMark += action.retargetCount ?? 0
    this.uniqueSquads.add(`${source.team}:${action.markSquadId}`)
    this.active.set(action.unitId, {
      team: source.team,
      squadId: action.markSquadId,
      expiresAt: tick + Math.max(1, action.markDuration ?? 1),
    })
  }

  private recordAttack(action: BattleAction): void {
    const attacker = this.units.get(action.unitId)
    const target = action.targetId ? this.units.get(action.targetId) : undefined
    if (!attacker || attacker.attack <= 0 || !target) return
    const teamMarks = this.getTeamSquads(attacker.team)
    if (teamMarks.size === 0) return
    this.values.alliedShotsWhileMarkActive++
    if (teamMarks.has(target.squadId)) this.values.shotsAgainstMarkedTargets++
  }

  private recordDamage(action: BattleAction): void {
    const attacker = this.units.get(action.sourceUnitId ?? action.unitId)
    const target = action.targetId ? this.units.get(action.targetId) : undefined
    const damage = Math.max(0, action.damage ?? 0)
    if (!attacker || !target || damage <= 0) return
    if (this.getTeamSquads(attacker.team).has(target.squadId)) {
      this.values.damageAgainstMarkedTargets += damage
      this.values.bonusDamageFromMarks += Math.max(0, action.bonusDamage ?? 0)
      this.values.markedTargetOverkillDamage += Math.max(0, damage - target.hp)
    }
    target.hp = Math.max(0, target.hp - damage)
  }

  private getTeamSquads(team: Team): Set<string> {
    const squads = new Set<string>()
    for (const mark of this.active.values()) {
      if (mark.team === team) squads.add(mark.squadId)
    }
    return squads
  }

  private expire(tick: number): void {
    for (const [sourceId, mark] of this.active) {
      if (mark.expiresAt <= tick) this.active.delete(sourceId)
    }
  }
}

export function emptyMarkCombatMetrics(): MarkCombatMetrics {
  return {
    firstMarkTick: null,
    markUptimeTicks: 0,
    uniqueMarkedSquads: 0,
    designationSwitchCount: 0,
    markRefreshCount: 0,
    alliedShotsWhileMarkActive: 0,
    shotsAgainstMarkedTargets: 0,
    markUtilization: 0,
    damageAgainstMarkedTargets: 0,
    bonusDamageFromMarks: 0,
    alliesRetargetedByMark: 0,
    markedTargetOverkillDamage: 0,
  }
}

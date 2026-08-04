import type { Team } from '../combat.sim.types'
import type { EntityId } from './entity'
import type { CompiledAbilityProgram } from '../combat.ability-compiler'

export type PendingImpactKind = 'projectile' | 'ground_targeted'

export interface PendingImpactInput {
  sourceId: EntityId
  sourceExternalId: string
  sourceTeam: Team
  targetId?: EntityId
  targetX: number
  targetY: number
  launchTick: number
  impactTick: number
  kind: PendingImpactKind
  directDamage: number
  areaDamage: number
  areaRadius: number
  interceptable: boolean
  programs?: CompiledAbilityProgram[]
}

export interface PendingImpact extends PendingImpactInput {
  id: number
}

export interface AttackTimelineState {
  targetId: EntityId
  targetX: number
  targetY: number
  remainingTicks: number
  kind: PendingImpactKind
  startedTick: number
}

/** Deterministic, tick-indexed queue for launched attacks. */
export class PendingImpactQueue {
  private nextId = 1
  private readonly byTick = new Map<number, PendingImpact[]>()

  enqueue(input: PendingImpactInput): PendingImpact {
    const impact = { ...input, id: this.nextId++ }
    const bucket = this.byTick.get(impact.impactTick) ?? []
    bucket.push(impact)
    this.byTick.set(impact.impactTick, bucket)
    return impact
  }

  take(tick: number): PendingImpact[] {
    const impacts = this.byTick.get(tick) ?? []
    this.byTick.delete(tick)
    return impacts.sort((left, right) => left.id - right.id)
  }

  hasDamagePending(): boolean {
    return this.byTick.size > 0
  }

  size(): number {
    return [...this.byTick.values()].reduce((total, bucket) => total + bucket.length, 0)
  }
}

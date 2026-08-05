import type { Team } from '../combat.sim.types'
import type { EntityId } from './entity'
import type { CompiledAbilityProgram } from '../combat.ability-compiler'
import type { DamageSourceContext } from './damage-source'

export type PendingImpactKind = 'projectile' | 'ground_targeted'
export type ImpactPositionPolicy = 'tracked_target' | 'captured_at_launch' | 'captured_at_windup'

export type ImpactPayload =
  | { kind: 'direct'; damage: number; targetId?: EntityId; targetExternalId?: string }
  | { kind: 'area'; damage: number; radius: number; maxTargets?: number }

export interface PendingImpactInput {
  sourceId: EntityId
  sourceExternalId: string
  sourceTeam: Team
  targetTeam?: Team
  hostileTeamAtLaunch?: Team
  canTargetAir?: boolean
  canTargetGround?: boolean
  sourceContext?: DamageSourceContext
  targetId?: EntityId
  targetX: number
  targetY: number
  launchTick: number
  impactTick: number
  kind: PendingImpactKind
  positionPolicy?: ImpactPositionPolicy
  payload: ImpactPayload
  interceptionDamage?: number
  interceptable: boolean
  programs?: readonly CompiledAbilityProgram[]
}

export interface PendingImpact extends PendingImpactInput {
  id: number
  positionPolicy: ImpactPositionPolicy
  payload: ImpactPayload
  interceptionDamage: number
}

export interface AttackTimelineState {
  targetId: EntityId
  targetExternalId: string
  targetX: number
  targetY: number
  aimX: number
  aimY: number
  kind: PendingImpactKind
  startedTick: number
  minimumLaunchTick: number
  positionPolicy: ImpactPositionPolicy
  controlMode: 'none' | 'redirect' | 'confuse'
}

/** Deterministic, tick-indexed queue for launched attacks. */
export class PendingImpactQueue {
  private nextId = 1
  private readonly byTick = new Map<number, PendingImpact[]>()

  enqueue(input: PendingImpactInput): PendingImpact {
    const payload = structuredClone(input.payload)
    const impact = {
      ...input,
      payload,
      sourceContext: input.sourceContext ? structuredClone(input.sourceContext) : undefined,
      programs: input.programs ? structuredClone(input.programs) : undefined,
      targetTeam: input.targetTeam ?? (input.sourceTeam === 'attacker' ? 'defender' : 'attacker'),
      hostileTeamAtLaunch: input.hostileTeamAtLaunch ?? input.targetTeam ?? (input.sourceTeam === 'attacker' ? 'defender' : 'attacker'),
      canTargetAir: input.canTargetAir ?? true,
      canTargetGround: input.canTargetGround ?? true,
      positionPolicy: input.positionPolicy ?? (input.kind === 'ground_targeted' ? 'captured_at_windup' : 'tracked_target'),
      interceptionDamage: input.interceptionDamage ?? payload.damage,
      id: this.nextId++,
    }
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

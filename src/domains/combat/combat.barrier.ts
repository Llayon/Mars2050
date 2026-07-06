import type { SimHazard, SimUnit } from './combat.sim.types'
import { getDistance } from './combat.utils'

export interface FiniteBarrierResult {
  damage: number
  breaks: { hazardId: string; sourceUnitId: string }[]
}

export function applyFiniteBarriers(target: SimUnit, damage: number, hazards: SimHazard[] | undefined): FiniteBarrierResult {
  if (!hazards || damage <= 0) return { damage, breaks: [] }

  let remaining = damage
  const breaks: { hazardId: string; sourceUnitId: string }[] = []
  const barriers = hazards
    .filter(hazard => hazard.type === 'barrier_dome' && hazard.team === target.team && hazard.duration > 0 && (hazard.capacity ?? 0) > 0 && getDistance(target.x, target.y, hazard.x, hazard.y) <= hazard.radius)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const barrier of barriers) {
    if (remaining <= 0) break
    const absorbed = Math.min(remaining, barrier.capacity ?? 0)
    barrier.capacity = Math.max(0, (barrier.capacity ?? 0) - absorbed)
    remaining -= absorbed
    if (barrier.capacity <= 0) {
      barrier.duration = 0
      breaks.push({ hazardId: barrier.id, sourceUnitId: barrier.sourceUnitId ?? barrier.id })
    }
  }

  return { damage: remaining, breaks }
}

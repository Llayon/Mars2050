import type { ArenaDeployment } from './contracts/index.js'
import type { Team } from './combat.sim.types.js'

export interface ResolvedDeploymentBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Resolves the deployment bounds for a given team based on arena dimensions
 * and optional explicit deployment configuration.
 *
 * Rules:
 * 1. If explicit team zones (minX/maxX, minY/maxY) are configured, use them.
 * 2. If explicit depth is configured, use depth from top (defender) and bottom (attacker).
 * 3. Default neutral behavior: derives deployment depth from arena height (up to 25% of height).
 *
 * @param arena - Arena specifications including dimensions and optional deployment data.
 * @param team - Team ('attacker' | 'defender') to resolve bounds for.
 * @returns Bounding box for valid unit placement.
 */
export function resolveDeploymentBounds(
  arena: { width: number; height: number; deployment?: ArenaDeployment },
  team: Team,
): ResolvedDeploymentBounds {
  const deployment = arena.deployment
  const teamZone = deployment?.[team]

  const minX = teamZone?.minX ?? 0
  const maxX = teamZone?.maxX ?? arena.width

  let minY: number
  let maxY: number

  if (teamZone?.minY != null || teamZone?.maxY != null) {
    minY = teamZone.minY ?? 0
    maxY = teamZone.maxY ?? arena.height
  } else if (deployment?.depth != null) {
    const depth = deployment.depth
    if (team === 'attacker') {
      minY = arena.height - depth
      maxY = arena.height
    } else {
      minY = 0
      maxY = depth
    }
  } else {
    // Neutral default: derive deployment depth from arena height (clamped between 1 and 25%)
    const depth = Math.max(1, Math.min(Math.floor(arena.height / 2), Math.floor(arena.height * 0.25)))
    if (team === 'attacker') {
      minY = arena.height - depth
      maxY = arena.height
    } else {
      minY = 0
      maxY = depth
    }
  }

  return { minX, maxX, minY, maxY }
}

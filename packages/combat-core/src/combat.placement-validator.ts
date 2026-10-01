import { CombatDefinitionError } from './combat.definition-error.js'
import type { BattleInput, UnitDefinition } from './contracts/index.js'
import type { NormalizedDefinition } from './combat.definition-validator.js'
import { resolveDeploymentBounds } from './combat.deployment-bounds.js'
import { getFormationOffset, getSizeRadius } from './math/index.js'

/**
 * Validates arena bounds, deployment configuration, obstacle placement,
 * and individual unit/squad positions before simulation.
 *
 * Enforces:
 * - Arena deployment zones and depth ranges are strictly within arena bounds.
 * - Obstacles do not exceed arena boundaries.
 * - Unit and squad coordinates (including formation member offsets) are within bounds.
 * - Squad formations that physically cannot fit in the arena or deployment zone are rejected.
 *
 * @param parsed - Validated battle input structure.
 * @param allDefs - Normalized unit definitions map.
 */
export function validatePlacementAndBounds(
  parsed: BattleInput,
  allDefs: Record<string, NormalizedDefinition | UnitDefinition>,
): void {
  // 1. Validate explicit deployment options
  if (parsed.arena.deployment) {
    const dep = parsed.arena.deployment
    if (dep.depth != null && (dep.depth <= 0 || dep.depth > parsed.arena.height)) {
      throw new CombatDefinitionError(
        'INVALID_FIELD_RANGE',
        `arena.deployment.depth (${dep.depth}) must be positive and <= arena height (${parsed.arena.height})`,
        { path: 'arena.deployment.depth', reference: String(dep.depth) },
      )
    }
    const teams = ['attacker', 'defender'] as const
    for (const team of teams) {
      const zone = dep[team]
      if (!zone) continue
      if (zone.minX != null && (zone.minX < 0 || zone.minX >= parsed.arena.width)) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.minX (${zone.minX}) outside arena width (${parsed.arena.width})`,
          { path: `arena.deployment.${team}.minX`, reference: String(zone.minX) },
        )
      }
      if (zone.maxX != null && (zone.maxX <= 0 || zone.maxX > parsed.arena.width)) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.maxX (${zone.maxX}) outside arena width (${parsed.arena.width})`,
          { path: `arena.deployment.${team}.maxX`, reference: String(zone.maxX) },
        )
      }
      if (zone.minX != null && zone.maxX != null && zone.minX >= zone.maxX) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.minX (${zone.minX}) must be less than maxX (${zone.maxX})`,
          { path: `arena.deployment.${team}`, reference: `${zone.minX}>=${zone.maxX}` },
        )
      }
      if (zone.minY != null && (zone.minY < 0 || zone.minY >= parsed.arena.height)) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.minY (${zone.minY}) outside arena height (${parsed.arena.height})`,
          { path: `arena.deployment.${team}.minY`, reference: String(zone.minY) },
        )
      }
      if (zone.maxY != null && (zone.maxY <= 0 || zone.maxY > parsed.arena.height)) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.maxY (${zone.maxY}) outside arena height (${parsed.arena.height})`,
          { path: `arena.deployment.${team}.maxY`, reference: String(zone.maxY) },
        )
      }
      if (zone.minY != null && zone.maxY != null && zone.minY >= zone.maxY) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `deployment.${team}.minY (${zone.minY}) must be less than maxY (${zone.maxY})`,
          { path: `arena.deployment.${team}`, reference: `${zone.minY}>=${zone.maxY}` },
        )
      }
    }
  }

  // 2. Validate obstacle bounds
  for (let i = 0; i < parsed.arena.obstacles.length; i++) {
    const obs = parsed.arena.obstacles[i]
    if (obs.x < 0 || obs.x > parsed.arena.width || obs.y < 0 || obs.y > parsed.arena.height) {
      throw new CombatDefinitionError(
        'OUT_OF_BOUNDS_COORDINATES',
        `obstacle at index ${i} coordinates (${obs.x}, ${obs.y}) outside arena bounds (${parsed.arena.width}x${parsed.arena.height})`,
        { path: `arena.obstacles[${i}]`, reference: `(${obs.x},${obs.y})` },
      )
    }
  }

  // 3. Validate unit placements and squad formation bounds
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    const def = allDefs[u.definitionId]
    const squadSize = Math.max(1, Math.floor(def?.squadSize ?? 1))
    const spacing = def?.squadSpacing ?? 20
    const rowSize = Math.ceil(Math.sqrt(squadSize))
    const formation = def?.formation ?? 'grid'
    const rawSize = (def as NormalizedDefinition)?.baseStats?.size ?? (def as UnitDefinition)?.baseStats?.size ?? 'M'
    const bodyRadius = getSizeRadius(rawSize as 'S' | 'M' | 'L' | 'XL')

    if (u.placement.x != null && (u.placement.x < 0 || u.placement.x > parsed.arena.width)) {
      throw new CombatDefinitionError(
        'OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' x coordinate (${u.placement.x}) outside arena width (${parsed.arena.width})`,
        { path: `units[${i}].placement.x`, reference: String(u.placement.x) },
      )
    }
    if (u.placement.y != null && (u.placement.y < 0 || u.placement.y > parsed.arena.height)) {
      throw new CombatDefinitionError(
        'OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' y coordinate (${u.placement.y}) outside arena height (${parsed.arena.height})`,
        { path: `units[${i}].placement.y`, reference: String(u.placement.y) },
      )
    }

    const offsets = Array.from({ length: squadSize }, (_, s) =>
      getFormationOffset(s, squadSize, rowSize, spacing, formation, u.team),
    )
    const minOffsetX = Math.min(...offsets.map(o => o.x))
    const maxOffsetX = Math.max(...offsets.map(o => o.x))
    const minOffsetY = Math.min(...offsets.map(o => o.y))
    const maxOffsetY = Math.max(...offsets.map(o => o.y))
    const formationWidth = maxOffsetX - minOffsetX
    const formationHeight = maxOffsetY - minOffsetY
    const formationPhysicalWidth = formationWidth + 2 * bodyRadius
    const formationPhysicalHeight = formationHeight + 2 * bodyRadius

    if (formationPhysicalWidth > parsed.arena.width || formationPhysicalHeight > parsed.arena.height) {
      throw new CombatDefinitionError(
        'OUT_OF_BOUNDS_COORDINATES',
        `squad formation for unit '${u.instanceId}' (${formationPhysicalWidth}x${formationPhysicalHeight}) exceeds arena dimensions (${parsed.arena.width}x${parsed.arena.height})`,
        { path: `units[${i}].definitionId`, reference: `${formationPhysicalWidth}x${formationPhysicalHeight}` },
      )
    }

    const bounds = resolveDeploymentBounds(parsed.arena, u.team)
    const zoneWidth = bounds.maxX - bounds.minX
    const zoneHeight = bounds.maxY - bounds.minY
    const strategy = parsed.arena.deployment?.strategy ?? 'fit_formation'

    // Validate X axis
    if (u.placement.x != null) {
      const minX = strategy === 'center' && squadSize > 1 ? 0 : bodyRadius
      const maxX = strategy === 'center' && squadSize > 1 ? parsed.arena.width : parsed.arena.width - bodyRadius
      for (let s = 0; s < squadSize; s++) {
        const memberId = squadSize > 1 ? `${u.instanceId}_${s}` : u.instanceId
        const mx = u.placement.x + offsets[s].x
        if (mx < minX - 1e-4 || mx > maxX + 1e-4) {
          throw new CombatDefinitionError(
            'OUT_OF_BOUNDS_COORDINATES',
            `squad member '${memberId}' body extends outside arena width (${parsed.arena.width})`,
            { path: `units[${i}].placement.x`, reference: String(mx) },
          )
        }
      }
    } else if (strategy === 'fit_formation' || squadSize === 1) {
      const leftPad = Math.max(0, -minOffsetX)
      const rightPad = Math.max(0, maxOffsetX)
      if (zoneWidth < leftPad + rightPad) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `squad formation for unit '${u.instanceId}' width (${formationWidth}) exceeds deployment zone width (${zoneWidth})`,
          { path: `units[${i}].definitionId`, reference: `${formationWidth}>${zoneWidth}` },
        )
      }
      const minSpawnX = Math.max(bounds.minX - minOffsetX, bodyRadius - minOffsetX)
      const maxSpawnX = Math.min(bounds.maxX - maxOffsetX, parsed.arena.width - bodyRadius - maxOffsetX)
      if (minSpawnX > maxSpawnX) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `unit '${u.instanceId}' cannot fit in deployment zone width with physical body radius`,
          { path: `units[${i}].definitionId`, reference: `${minSpawnX}>${maxSpawnX}` },
        )
      }
    }

    // Validate Y axis
    if (u.placement.y != null) {
      const minY = strategy === 'center' && squadSize > 1 ? 0 : bodyRadius
      const maxY = strategy === 'center' && squadSize > 1 ? parsed.arena.height : parsed.arena.height - bodyRadius
      for (let s = 0; s < squadSize; s++) {
        const memberId = squadSize > 1 ? `${u.instanceId}_${s}` : u.instanceId
        const my = u.placement.y + offsets[s].y
        if (my < minY - 1e-4 || my > maxY + 1e-4) {
          throw new CombatDefinitionError(
            'OUT_OF_BOUNDS_COORDINATES',
            `squad member '${memberId}' body extends outside arena height (${parsed.arena.height})`,
            { path: `units[${i}].placement.y`, reference: String(my) },
          )
        }
      }
    } else if (strategy === 'fit_formation' || squadSize === 1) {
      const topPad = Math.max(0, -minOffsetY)
      const bottomPad = Math.max(0, maxOffsetY)
      if (zoneHeight < topPad + bottomPad) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `squad formation for unit '${u.instanceId}' height (${formationHeight}) exceeds deployment zone height (${zoneHeight})`,
          { path: `units[${i}].definitionId`, reference: `${formationHeight}>${zoneHeight}` },
        )
      }
      const minSpawnY = Math.max(bounds.minY - minOffsetY, bodyRadius - minOffsetY)
      const maxSpawnY = Math.min(bounds.maxY - maxOffsetY, parsed.arena.height - bodyRadius - maxOffsetY)
      if (minSpawnY > maxSpawnY) {
        throw new CombatDefinitionError(
          'OUT_OF_BOUNDS_COORDINATES',
          `unit '${u.instanceId}' cannot fit in deployment zone height with physical body radius`,
          { path: `units[${i}].definitionId`, reference: `${minSpawnY}>${maxSpawnY}` },
        )
      }
    }
  }
}

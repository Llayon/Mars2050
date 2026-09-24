import { battleInputSchema, type BattleInput, type UnitDefinition } from './contracts/index.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import { TARGETING_PROFILES } from './combat.targeting.config.js'
import { calculateEffectiveMaxHp } from './combat.unit-stat-compiler.js'
import type { CombatCatalog } from './combat.catalog.types.js'

const SUPPORTED_SCHEDULED_EFFECT_KINDS = ['orbital_strike', 'mass_heal', 'mass_shield', 'global_emp']

interface AnyDef {
  id?: string
  targetingProfile?: string
  squadSize?: number
  baseStats?: {
    attackType?: string
    spawnType?: string
    spawnCap?: number
    targetingProfile?: string
    statusOnHit?: Array<{ duration?: number }>
  }
}

export function validateBattleInput(input: unknown): BattleInput {
  // 1. Structural schema validation via Zod safeParse
  const schemaResult = battleInputSchema.safeParse(input)
  if (!schemaResult.success) {
    const firstIssue = schemaResult.error.issues[0]
    const pathStr = firstIssue ? firstIssue.path.join('.') : ''
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `Schema validation failed: ${firstIssue ? firstIssue.message : 'invalid input'} at '${pathStr}'`,
      {
        path: pathStr,
        reference: String((firstIssue as unknown as { received?: unknown })?.received ?? ''),
        issues: schemaResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    )
  }

  const parsed = schemaResult.data

  // 2. Definition key consistency
  for (const [key, def] of Object.entries(parsed.definitions)) {
    if (key !== def.id) {
      throw new CombatDefinitionError(
        'INVALID_DEFINITION_KEY',
        `definition key '${key}' does not match definition id '${def.id}'`,
        { path: `definitions.${key}.id`, reference: def.id, definitionId: def.id },
      )
    }
  }

  // 3. Collect accessible definitions and catalog components
  const allDefs: Record<string, AnyDef> = {}
  const allDefIds = new Set<string>()
  const catUnitTypes = (parsed.catalog as { unitTypes?: Record<string, AnyDef> } | undefined)?.unitTypes
  if (catUnitTypes && typeof catUnitTypes === 'object') {
    for (const [k, v] of Object.entries(catUnitTypes)) {
      if (v) { allDefs[k] = v; allDefIds.add(k) }
    }
  }
  for (const [k, v] of Object.entries(parsed.definitions)) {
    allDefs[k] = v; allDefIds.add(k)
  }

  const allTargetingProfiles = new Set<string>(Object.keys(TARGETING_PROFILES))
  const catProfiles = (parsed.catalog as { targetingProfiles?: Record<string, unknown> } | undefined)?.targetingProfiles
  if (catProfiles && typeof catProfiles === 'object') Object.keys(catProfiles).forEach(k => allTargetingProfiles.add(k))

  const allUpgradeIds = new Set<string>()
  const catUpgrades = (parsed.catalog as { upgrades?: Record<string, unknown> } | undefined)?.upgrades
  if (catUpgrades && typeof catUpgrades === 'object') Object.keys(catUpgrades).forEach(k => allUpgradeIds.add(k))

  // 4. Validate all definitions (attackType, spawnType, targetingProfile, statusOnHit)
  for (const [id, def] of Object.entries(allDefs)) {
    const attackType = def.baseStats?.attackType
    if (attackType === 'beam' || attackType === 'spread') {
      throw new CombatDefinitionError(
        'UNSUPPORTED_ATTACK_TYPE', id, attackType,
        { path: `definitions.${id}.baseStats.attackType`, reference: attackType },
      )
    }
    if (attackType === 'spawn' && !def.baseStats?.spawnType) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_TYPE',
        `definition '${id}' with attackType 'spawn' requires non-empty spawnType`,
        { path: `definitions.${id}.baseStats.spawnType`, definitionId: id },
      )
    }
    const spawnType = def.baseStats?.spawnType
    if (spawnType && !allDefIds.has(spawnType)) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_DEFINITION',
        `definition '${id}' spawns unknown definition '${spawnType}'`,
        { path: `definitions.${id}.baseStats.spawnType`, reference: spawnType, definitionId: id },
      )
    }
    const profile = def.targetingProfile ?? def.baseStats?.targetingProfile
    if (profile && !allTargetingProfiles.has(profile)) {
      throw new CombatDefinitionError('MISSING_DEFINITION',
        `definition '${id}' references unknown targetingProfile '${profile}'`,
        { path: `definitions.${id}.targetingProfile`, reference: profile, definitionId: id })
    }
    if (def.baseStats?.statusOnHit) {
      for (let s = 0; s < def.baseStats.statusOnHit.length; s++) {
        const st = def.baseStats.statusOnHit[s]
        if (!st.duration || !Number.isInteger(st.duration) || st.duration <= 0) {
          throw new CombatDefinitionError('INVALID_FIELD_RANGE',
            `definition '${id}' statusOnHit[${s}] duration (${st.duration}) must be a positive integer`,
            { path: `definitions.${id}.baseStats.statusOnHit[${s}].duration`, reference: String(st.duration), definitionId: id })
        }
      }
    }
  }

  // 5. Units validation (definitions reference, instanceId uniqueness, upgradeIds)
  const seenInstanceIds = new Set<string>()
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (!allDefIds.has(u.definitionId)) {
      throw new CombatDefinitionError('MISSING_DEFINITION',
        `unit '${u.instanceId}' references unknown definitionId '${u.definitionId}'`,
        { path: `units[${i}].definitionId`, reference: u.definitionId })
    }
    if (seenInstanceIds.has(u.instanceId)) {
      throw new CombatDefinitionError('DUPLICATE_INSTANCE_ID',
        `duplicate unit instanceId '${u.instanceId}' at index ${i}`,
        { path: `units[${i}].instanceId`, reference: u.instanceId })
    }
    seenInstanceIds.add(u.instanceId)
    for (let j = 0; j < u.upgradeIds.length; j++) {
      const upgId = u.upgradeIds[j]
      if (!allUpgradeIds.has(upgId)) {
        throw new CombatDefinitionError('MISSING_DEFINITION',
          `unit '${u.instanceId}' references unknown upgradeId '${upgId}'`,
          { path: `units[${i}].upgradeIds[${j}]`, reference: upgId })
      }
    }
  }

  // 6. Squad member ID collision check
  const allMemberIds = new Set<string>()
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    const def = allDefs[u.definitionId]
    const squadSize = def?.squadSize || 1
    for (let s = 0; s < squadSize; s++) {
      const memberId = squadSize > 1 ? `${u.instanceId}_${s}` : u.instanceId
      if (allMemberIds.has(memberId)) {
        throw new CombatDefinitionError('DUPLICATE_SQUAD_MEMBER_ID',
          `squad member id collision for '${memberId}' at unit index ${i}`,
          { path: `units[${i}].instanceId`, reference: memberId })
      }
      allMemberIds.add(memberId)
    }
  }

  // 7. Cycle check: only nodes actually participating in the cycle require spawnCap
  for (const startId of Object.keys(allDefs)) {
    const path: string[] = []
    const visitedSet = new Set<string>()
    let current: string | undefined = startId
    while (current) {
      if (visitedSet.has(current)) {
        const cycleStartIndex = path.indexOf(current)
        if (cycleStartIndex !== -1) {
          const cycleNodes = path.slice(cycleStartIndex)
          const hasNoCap = cycleNodes.some(nodeId => {
            const nodeDef = allDefs[nodeId]
            return nodeDef?.baseStats?.attackType === 'spawn' && (nodeDef.baseStats.spawnCap == null || nodeDef.baseStats.spawnCap <= 0)
          })
          if (hasNoCap) {
            throw new CombatDefinitionError('UNCONSTRAINED_SUMMON_CYCLE',
              `unconstrained summon cycle detected for definition '${current}' without spawnCap`,
              { path: `definitions.${current}.baseStats.spawnCap`, definitionId: current })
          }
        }
        break
      }
      visitedSet.add(current)
      path.push(current)
      const nextSpawn: string | undefined = allDefs[current]?.baseStats?.spawnType
      if (!nextSpawn || !allDefs[nextSpawn]) break
      current = nextSpawn
    }
  }

  // 8. Coordinate and Arena Bounds
  for (let i = 0; i < parsed.arena.obstacles.length; i++) {
    const obs = parsed.arena.obstacles[i]
    if (obs.x < 0 || obs.x > parsed.arena.width || obs.y < 0 || obs.y > parsed.arena.height) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `obstacle at index ${i} coordinates (${obs.x}, ${obs.y}) outside arena bounds (${parsed.arena.width}x${parsed.arena.height})`,
        { path: `arena.obstacles[${i}]`, reference: `(${obs.x},${obs.y})` })
    }
  }

  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (u.placement.x != null && (u.placement.x < 0 || u.placement.x > parsed.arena.width)) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' x coordinate (${u.placement.x}) outside arena width (${parsed.arena.width})`,
        { path: `units[${i}].placement.x`, reference: String(u.placement.x) })
    }
    if (u.placement.y != null && (u.placement.y < 0 || u.placement.y > parsed.arena.height)) {
      throw new CombatDefinitionError('OUT_OF_BOUNDS_COORDINATES',
        `unit '${u.instanceId}' y coordinate (${u.placement.y}) outside arena height (${parsed.arena.height})`,
        { path: `units[${i}].placement.y`, reference: String(u.placement.y) })
    }
  }

  // 9. Field ranges and values (effective maxHp and scheduled effect payloads)
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (u.currentHp != null) {
      const effectiveMax = calculateEffectiveMaxHp(
        u.definitionId, u.rank, u.upgradeIds,
        parsed.catalog as unknown as CombatCatalog | undefined, parsed.definitions,
      )
      if (effectiveMax !== undefined && u.currentHp > effectiveMax) {
        throw new CombatDefinitionError('INVALID_FIELD_RANGE',
          `unit '${u.instanceId}' currentHp (${u.currentHp}) exceeds max hp (${effectiveMax})`,
          { path: `units[${i}].currentHp`, reference: String(u.currentHp) })
      }
    }
  }

  for (let i = 0; i < parsed.scheduledEffects.length; i++) {
    const eff = parsed.scheduledEffects[i]
    if (!SUPPORTED_SCHEDULED_EFFECT_KINDS.includes(eff.type)) {
      throw new CombatDefinitionError('UNSUPPORTED_SCHEDULED_EFFECT', '', '',
        { effectId: eff.id, effectType: eff.type, path: `scheduledEffects[${i}].type`, reference: eff.type })
    }
    if (!Number.isFinite(eff.value) || eff.value <= 0) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `scheduled effect '${eff.id}' value (${eff.value}) must be positive and finite`,
        { path: `scheduledEffects[${i}].value`, reference: String(eff.value) })
    }
    if (eff.type === 'global_emp' && (!Number.isInteger(eff.value) || eff.value <= 0)) {
      throw new CombatDefinitionError('INVALID_FIELD_RANGE',
        `scheduled effect '${eff.id}' global_emp duration value (${eff.value}) must be a positive integer`,
        { path: `scheduledEffects[${i}].value`, reference: String(eff.value) })
    }
  }

  return parsed
}

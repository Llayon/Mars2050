import { battleInputSchema, type BattleInput, type UnitDefinition } from './contracts/index.js'
import { CombatDefinitionError } from './combat.definition-error.js'

const SUPPORTED_SCHEDULED_EFFECT_KINDS = ['orbital_strike', 'mass_heal', 'mass_shield', 'global_emp']

/**
 * Validates the full BattleInput before simulation starts.
 *
 * Guarantees referential integrity, bounds, unique identities, and supported
 * mechanics before world creation or RNG consumption (R3a).
 *
 * @param input Raw or partially-constructed BattleInput
 * @returns Fully validated BattleInput with defaults applied
 * @throws CombatDefinitionError on any schema or referential violation
 */
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

  // 3. Attack type validation inside definitions
  for (const [id, def] of Object.entries(parsed.definitions)) {
    if (def.baseStats.attackType === 'beam' || def.baseStats.attackType === 'spread') {
      throw new CombatDefinitionError(
        'UNSUPPORTED_ATTACK_TYPE',
        id,
        def.baseStats.attackType,
        { path: `definitions.${id}.baseStats.attackType`, reference: def.baseStats.attackType },
      )
    }
    if (def.baseStats.attackType === 'spawn' && !def.baseStats.spawnType) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_TYPE',
        `definition '${id}' with attackType 'spawn' requires non-empty spawnType`,
        { path: `definitions.${id}.baseStats.spawnType`, definitionId: id },
      )
    }
  }

  // 4. Collect all accessible definition IDs (definitions + catalog)
  const allDefIds = new Set<string>(Object.keys(parsed.definitions))
  if (parsed.catalog && typeof parsed.catalog === 'object' && 'unitTypes' in parsed.catalog) {
    const cat = parsed.catalog as { unitTypes?: Record<string, unknown> }
    if (cat.unitTypes) Object.keys(cat.unitTypes).forEach(k => allDefIds.add(k))
  }

  // 5. Units must reference valid definitions
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (!allDefIds.has(u.definitionId)) {
      throw new CombatDefinitionError(
        'MISSING_DEFINITION',
        `unit '${u.instanceId}' references unknown definitionId '${u.definitionId}'`,
        { path: `units[${i}].definitionId`, reference: u.definitionId },
      )
    }
  }

  // 6. Unit instanceId uniqueness
  const seenInstanceIds = new Set<string>()
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (seenInstanceIds.has(u.instanceId)) {
      throw new CombatDefinitionError(
        'DUPLICATE_INSTANCE_ID',
        `duplicate unit instanceId '${u.instanceId}' at index ${i}`,
        { path: `units[${i}].instanceId`, reference: u.instanceId },
      )
    }
    seenInstanceIds.add(u.instanceId)
  }

  // 7. Squad member ID collision check
  const allMemberIds = new Set<string>()
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    const def = parsed.definitions[u.definitionId] ?? (parsed.catalog as { unitTypes?: Record<string, UnitDefinition> } | undefined)?.unitTypes?.[u.definitionId]
    const squadSize = def?.squadSize || 1
    for (let s = 0; s < squadSize; s++) {
      const memberId = squadSize > 1 ? `${u.instanceId}_${s}` : u.instanceId
      if (allMemberIds.has(memberId)) {
        throw new CombatDefinitionError(
          'DUPLICATE_SQUAD_MEMBER_ID',
          `squad member id collision for '${memberId}' at unit index ${i}`,
          { path: `units[${i}].instanceId`, reference: memberId },
        )
      }
      allMemberIds.add(memberId)
    }
  }

  // 8. Transitive spawnType references and unconstrained summon cycle check
  for (const [id, def] of Object.entries(parsed.definitions)) {
    const spawnType = def.baseStats.spawnType
    if (spawnType && !allDefIds.has(spawnType)) {
      throw new CombatDefinitionError(
        'MISSING_SPAWN_DEFINITION',
        `definition '${id}' spawns unknown definition '${spawnType}'`,
        { path: `definitions.${id}.baseStats.spawnType`, reference: spawnType, definitionId: id },
      )
    }
  }

  for (const startId of Object.keys(parsed.definitions)) {
    const visited = new Set<string>()
    let current: string | undefined = startId
    while (current) {
      visited.add(current)
      const currentDef: UnitDefinition | undefined = parsed.definitions[current]
      const nextSpawn: string | undefined = currentDef?.baseStats?.spawnType
      if (!nextSpawn || !parsed.definitions[nextSpawn]) break
      if (visited.has(nextSpawn)) {
        const hasNoCap = Array.from(visited).some(nodeId => {
          const nodeDef = parsed.definitions[nodeId]
          return nodeDef?.baseStats?.attackType === 'spawn' && (nodeDef.baseStats.spawnCap == null || nodeDef.baseStats.spawnCap <= 0)
        })
        if (hasNoCap) {
          throw new CombatDefinitionError(
            'UNCONSTRAINED_SUMMON_CYCLE',
            `unconstrained summon cycle detected starting from definition '${startId}' without spawnCap`,
            { path: `definitions.${startId}.baseStats.spawnCap`, definitionId: startId },
          )
        }
        break
      }
      current = nextSpawn
    }
  }

  // 9. Coordinate and Arena Bounds
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

  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
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
  }

  // 10. Field ranges and values
  for (let i = 0; i < parsed.units.length; i++) {
    const u = parsed.units[i]
    if (u.currentHp != null) {
      const def = parsed.definitions[u.definitionId] ?? (parsed.catalog as { unitTypes?: Record<string, UnitDefinition> } | undefined)?.unitTypes?.[u.definitionId]
      if (def && u.currentHp > def.baseStats.hp) {
        throw new CombatDefinitionError(
          'INVALID_FIELD_RANGE',
          `unit '${u.instanceId}' currentHp (${u.currentHp}) exceeds max hp (${def.baseStats.hp})`,
          { path: `units[${i}].currentHp`, reference: String(u.currentHp) },
        )
      }
    }
  }

  for (let i = 0; i < parsed.scheduledEffects.length; i++) {
    const eff = parsed.scheduledEffects[i]
    if (!SUPPORTED_SCHEDULED_EFFECT_KINDS.includes(eff.type)) {
      throw new CombatDefinitionError(
        'UNSUPPORTED_SCHEDULED_EFFECT',
        '',
        '',
        { effectId: eff.id, effectType: eff.type, path: `scheduledEffects[${i}].type`, reference: eff.type },
      )
    }
  }

  return parsed
}

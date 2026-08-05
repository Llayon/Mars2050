import type { AbilityDefinition, AbilityEffect, AbilityTrigger, TargetSelector } from './combat.ability.types'

export const ABILITY_COMPILATION_ERROR_CODES = [
  'DUPLICATE_ID', 'UNSUPPORTED_COMBINATION', 'INVALID_NUMERIC_VALUE', 'INCOMPATIBLE_GEOMETRY',
] as const

export type AbilityCompilationErrorCode = typeof ABILITY_COMPILATION_ERROR_CODES[number]

export class AbilityCompilationError extends Error {
  readonly code: AbilityCompilationErrorCode
  readonly abilityId: string
  readonly path: string

  constructor(code: AbilityCompilationErrorCode, abilityId: string, path: string, message: string) {
    super(message)
    this.name = 'AbilityCompilationError'
    this.code = code
    this.abilityId = abilityId
    this.path = path
  }
}

export interface CompiledEffectGroup {
  selector: TargetSelector
  effects: AbilityEffect[]
}

export interface CompiledAbilityProgram {
  id: string
  trigger: AbilityTrigger
  priority: number
  groups: CompiledEffectGroup[]
}

const PRIMARY_GEOMETRY_EFFECTS = new Set<AbilityEffect['kind']>([
  'split_fire', 'chain_attack', 'side_weapon', 'barrage_attack',
  'line_pierce', 'cone_attack', 'beam_attack',
])

export function compileAbilityDefinitions(definitions: AbilityDefinition[]): CompiledAbilityProgram[] {
  const ids = new Set<string>()
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new AbilityCompilationError('DUPLICATE_ID', definition.id, 'id', `Duplicate ability id: ${definition.id}`)
    ids.add(definition.id)
    validateDefinition(definition)
  }
  return definitions
    .map(definition => compileAbilityDefinition(definition))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
}

function compileAbilityDefinition(definition: AbilityDefinition): CompiledAbilityProgram {
  return {
    id: definition.id,
    trigger: definition.trigger,
    priority: definition.priority ?? 0,
    groups: definition.effects.map(group => ({
      selector: structuredClone(group.selector),
      effects: group.effects.map(effect => structuredClone(effect)),
    })),
  }
}

function validateDefinition(definition: AbilityDefinition): void {
  if (definition.effects.length === 0) {
    throw new AbilityCompilationError('UNSUPPORTED_COMBINATION', definition.id, 'effects', 'Ability must contain at least one effect group')
  }
  if (definition.trigger.kind === 'periodic' && (!Number.isInteger(definition.trigger.intervalTicks) || definition.trigger.intervalTicks <= 0)) {
    throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', definition.id, 'trigger.intervalTicks', 'Periodic interval must be a positive integer')
  }
  for (const [groupIndex, group] of definition.effects.entries()) {
    if (group.effects.length === 0) {
      throw new AbilityCompilationError('UNSUPPORTED_COMBINATION', definition.id, `effects[${groupIndex}]`, 'Effect group must not be empty')
    }
    validateSelector(definition.id, group.selector, `effects[${groupIndex}].selector`)
    for (const [effectIndex, effect] of group.effects.entries()) {
      validateEffect(definition.id, definition.trigger, group.selector, effect, `effects[${groupIndex}].effects[${effectIndex}]`)
    }
  }
  validateGeometry(definition)
}

function validateGeometry(definition: AbilityDefinition): void {
  if (definition.trigger.kind !== 'weapon_attack') return
  const geometryEffects = definition.effects.flatMap(group => group.effects)
    .filter(effect => PRIMARY_GEOMETRY_EFFECTS.has(effect.kind))
  if (geometryEffects.length > 1) {
    throw new AbilityCompilationError(
      'INCOMPATIBLE_GEOMETRY',
      definition.id,
      'effects',
      'A primary weapon ability may contain only one typed geometry effect',
    )
  }
}

function validateSelector(abilityId: string, selector: TargetSelector, path: string): void {
  if (selector.kind === 'area_at_target' || selector.kind === 'area_at_impact') {
    if (!Number.isFinite(selector.radius) || selector.radius <= 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, `${path}.radius`, 'Area radius must be positive')
    if (selector.maxTargets !== undefined && (!Number.isInteger(selector.maxTargets) || selector.maxTargets <= 0)) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, `${path}.maxTargets`, 'Maximum targets must be a positive integer')
  }
}

function validateEffect(abilityId: string, trigger: AbilityTrigger, selector: TargetSelector, effect: AbilityEffect, path: string): void {
  const allowed = trigger.kind === 'hit'
    ? (effect.kind === 'apply_status' || effect.kind === 'mark_target') && (selector.kind === 'primary_target' || selector.kind === 'area_at_target')
    : trigger.kind === 'weapon_attack'
      ? selector.kind === 'primary_target' && (effect.kind === 'split_fire' || effect.kind === 'chain_attack' || effect.kind === 'side_weapon' || effect.kind === 'barrage_attack' || effect.kind === 'line_pierce' || effect.kind === 'cone_attack' || effect.kind === 'beam_attack' || effect.kind === 'legacy_geometry')
      : trigger.kind === 'post_weapon_attack'
        ? selector.kind === 'primary_target' && effect.kind === 'displace'
        : trigger.kind === 'projectile_impact'
          ? (selector.kind === 'primary_target' || selector.kind === 'area_at_impact') && (effect.kind === 'damage' || effect.kind === 'apply_status' || effect.kind === 'mark_target')
          : selector.kind === 'self' && (effect.kind === 'support_aura' || effect.kind === 'periodic_payload')
  if (!allowed) throw new AbilityCompilationError('UNSUPPORTED_COMBINATION', abilityId, path, `${trigger.kind} cannot execute ${effect.kind} with ${selector.kind}`)
  if (effect.kind === 'damage') {
    const numeric = effect.expression.kind === 'fixed' ? effect.expression.amount : effect.expression.multiplier
    if (!Number.isFinite(numeric) || numeric < 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, `${path}.expression`, 'Damage expression must be finite and non-negative')
  }
  if (effect.kind === 'apply_status' || effect.kind === 'mark_target') {
    if (!Number.isFinite(effect.duration) || effect.duration <= 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, `${path}.duration`, 'Duration must be positive')
  }
  if (effect.kind === 'apply_status' && effect.value !== undefined) {
    assertFinite(abilityId, `${path}.value`, effect.value)
  }
  if (effect.kind === 'mark_target') {
    assertOptionalNonNegative(abilityId, `${path}.damageMultiplier`, effect.damageMultiplier)
    assertOptionalNonNegative(abilityId, `${path}.executeThreshold`, effect.executeThreshold)
    assertOptionalNonNegative(abilityId, `${path}.focusPriority`, effect.focusPriority)
    assertOptionalPositive(abilityId, `${path}.focusRadius`, effect.focusRadius)
    assertOptionalPositiveInteger(abilityId, `${path}.retargetLockTicks`, effect.retargetLockTicks)
  }
  if (effect.kind === 'displace') {
    if (!Number.isFinite(effect.radius) || effect.radius <= 0 || !Number.isFinite(effect.strength) || effect.strength < 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, path, 'Displacement values are invalid')
    if (effect.maxTargets !== undefined && (!Number.isInteger(effect.maxTargets) || effect.maxTargets <= 0)) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, `${path}.maxTargets`, 'Maximum targets must be a positive integer')
  }
  if (effect.kind === 'split_fire') {
    assertPositiveInteger(abilityId, `${path}.config.maxTargets`, effect.config.maxTargets)
    assertNonNegative(abilityId, `${path}.config.damageMultiplier`, effect.config.damageMultiplier)
    assertOptionalPositive(abilityId, `${path}.config.range`, effect.config.range)
  }
  if (effect.kind === 'chain_attack') {
    assertPositiveInteger(abilityId, `${path}.config.jumps`, effect.config.jumps)
    assertPositive(abilityId, `${path}.config.radius`, effect.config.radius)
    assertNonNegative(abilityId, `${path}.config.damageMultiplier`, effect.config.damageMultiplier)
    assertOptionalNonNegative(abilityId, `${path}.config.falloff`, effect.config.falloff)
  }
  if (effect.kind === 'side_weapon') {
    assertNonNegative(abilityId, `${path}.config.damage`, effect.config.damage)
    assertPositive(abilityId, `${path}.config.range`, effect.config.range)
    assertPositiveInteger(abilityId, `${path}.config.maxTargets`, effect.config.maxTargets)
  }
  if (effect.kind === 'barrage_attack') {
    assertPositiveInteger(abilityId, `${path}.config.impacts`, effect.config.impacts)
    assertPositive(abilityId, `${path}.config.radius`, effect.config.radius)
    assertNonNegative(abilityId, `${path}.config.spreadRadius`, effect.config.spreadRadius)
    assertNonNegative(abilityId, `${path}.config.damageMultiplier`, effect.config.damageMultiplier)
    assertOptionalPositiveInteger(abilityId, `${path}.config.maxTargetsPerImpact`, effect.config.maxTargetsPerImpact)
    assertOptionalPositiveInteger(abilityId, `${path}.config.impactIntervalTicks`, effect.config.impactIntervalTicks)
  }
  if (effect.kind === 'line_pierce' || effect.kind === 'beam_attack') {
    assertPositive(abilityId, `${path}.config.width`, effect.config.width)
    assertNonNegative(abilityId, `${path}.config.damageMultiplier`, effect.config.damageMultiplier)
    assertOptionalPositiveInteger(abilityId, `${path}.config.maxTargets`, effect.config.maxTargets)
  }
  if (effect.kind === 'cone_attack') {
    assertPositive(abilityId, `${path}.config.angleDeg`, effect.config.angleDeg)
    assertNonNegative(abilityId, `${path}.config.damageMultiplier`, effect.config.damageMultiplier)
    assertOptionalPositiveInteger(abilityId, `${path}.config.maxTargets`, effect.config.maxTargets)
  }
  if (effect.kind === 'support_aura') {
    assertPositive(abilityId, `${path}.aura.radius`, effect.aura.radius)
    assertFinite(abilityId, `${path}.aura.value`, effect.aura.value)
    assertOptionalPositive(abilityId, `${path}.aura.duration`, effect.aura.duration)
    assertOptionalPositiveInteger(abilityId, `${path}.aura.interval`, effect.aura.interval)
  }
  if (effect.kind === 'periodic_payload') {
    assertPositiveInteger(abilityId, `${path}.ability.intervalTicks`, effect.ability.intervalTicks)
    assertOptionalNonNegative(abilityId, `${path}.ability.initialDelayTicks`, effect.ability.initialDelayTicks)
    assertOptionalPositiveInteger(abilityId, `${path}.ability.charges`, effect.ability.charges)
    assertOptionalNonNegative(abilityId, `${path}.ability.minRange`, effect.ability.minRange)
    assertOptionalPositive(abilityId, `${path}.ability.maxRange`, effect.ability.maxRange)
  }
}

function assertFinite(abilityId: string, path: string, value: number): void {
  if (!Number.isFinite(value)) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, path, 'Value must be finite')
}

function assertPositive(abilityId: string, path: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, path, 'Value must be positive')
}

function assertNonNegative(abilityId: string, path: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, path, 'Value must be non-negative')
}

function assertPositiveInteger(abilityId: string, path: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new AbilityCompilationError('INVALID_NUMERIC_VALUE', abilityId, path, 'Value must be a positive integer')
}

function assertOptionalPositive(abilityId: string, path: string, value: number | undefined): void {
  if (value !== undefined) assertPositive(abilityId, path, value)
}

function assertOptionalNonNegative(abilityId: string, path: string, value: number | undefined): void {
  if (value !== undefined) assertNonNegative(abilityId, path, value)
}

function assertOptionalPositiveInteger(abilityId: string, path: string, value: number | undefined): void {
  if (value !== undefined) assertPositiveInteger(abilityId, path, value)
}

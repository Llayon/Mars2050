import type { AbilityDefinition, AbilityEffect, AbilityEffectGroup, TargetSelector } from './combat.ability.types'

export interface CompiledEffectGroup {
  selector: TargetSelector
  effects: AbilityEffect[]
}

export interface CompiledAbilityProgram {
  id: string
  trigger: AbilityDefinition['trigger']
  priority: number
  groups: CompiledEffectGroup[]
}

export function compileAbilityDefinitions(definitions: AbilityDefinition[]): CompiledAbilityProgram[] {
  return definitions
    .map(definition => compileAbilityDefinition(definition))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
}

function compileAbilityDefinition(definition: AbilityDefinition): CompiledAbilityProgram {
  return {
    id: definition.id,
    trigger: definition.trigger,
    priority: definition.priority ?? 0,
    groups: definition.effects.map(compileEffectGroup),
  }
}

function compileEffectGroup(group: AbilityEffectGroup): CompiledEffectGroup {
  return {
    selector: structuredClone(group.selector),
    effects: group.effects.map(compileEffect),
  }
}

function compileEffect(effect: AbilityEffect): AbilityEffect {
  if (effect.kind !== 'launch_projectile') return structuredClone(effect)
  return {
    ...effect,
    onImpact: effect.onImpact.map(compileEffectGroup),
  }
}

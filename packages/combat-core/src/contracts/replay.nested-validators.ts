import { z } from 'zod'
import {
  CANONICAL_SUPPORT_AURA_KEY_SET,
  CANONICAL_BURROW_CONFIG_KEY_SET,
  SNAPSHOT_OBJ_ALLOWED_KEY_SETS,
  SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS,
  ABILITY_PROGRAM_KEY_SET,
  ABILITY_TRIGGER_KEY_SET,
  ABILITY_GROUP_KEY_SET,
  ABILITY_SELECTOR_KEY_SET,
} from './replay.inventory.js'
import {
  checkFinite, isObj,
  GEOMETRY_CONFIG_SPECS,
  VALID_SELECTOR_KINDS,
  validateStatusEffectItem,
  validateGeometryConfig,
  validateFormationModifiers,
  validateRankScaling,
  validateFieldEffectItem,
  validateAbilityEffect,
  validateTriggerEffectItem,
  validatePeriodicAbilityItem,
} from './replay.nested-models.js'
export { checkFinite, isObj }


export function validateDetailsNode(node: unknown, ctx: z.RefinementCtx, path: string): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const it = node[i]
      if (typeof it === 'number' && !Number.isFinite(it)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number in details' })
      } else if (typeof it === 'object' && it !== null) {
        validateDetailsNode(it, ctx, `${path}[${i}]`)
      }
    }
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed private key in details: ${k}` })
      }
      if (typeof v === 'number' && !Number.isFinite(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in details: ${k}` })
      } else if (typeof v === 'object' && v !== null) {
        validateDetailsNode(v, ctx, `${path}.${k}`)
      }
    }
  }
}

export function validateDeepNode(node: unknown, ctx: z.RefinementCtx, path: string): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const it = node[i]
      if (it === null || it === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed null/undefined in ${path}[${i}]` })
      } else if (typeof it === 'number' && !Number.isFinite(it)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in ${path}[${i}]` })
      } else if (typeof it === 'object') {
        validateDeepNode(it, ctx, `${path}[${i}]`)
      }
    }
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed private key in ${path}: ${k}` })
      }
      if (typeof v === 'number' && !Number.isFinite(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in ${path}: ${k}` })
      } else if (typeof v === 'object' && v !== null) {
        validateDeepNode(v, ctx, `${path}.${k}`)
      }
    }
  }
}

export function validateSupportAuras(auras: unknown, ctx: z.RefinementCtx): void {
  if (!Array.isArray(auras)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'supportAuras must be an array' }); return }
  for (let i = 0; i < auras.length; i++) {
    const a = auras[i]
    if (!isObj(a) || typeof a.type !== 'string' || !a.type) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid supportAura item at [${i}]` }); continue }
    for (const k of Object.keys(a)) if (!CANONICAL_SUPPORT_AURA_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed supportAura key: ${k}` })
    for (const f of ['radius', 'value', 'duration', 'interval'] as const) if (a[f] !== undefined && !checkFinite(a[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for supportAura ${f}` })
    if (a.target !== undefined && a.target !== 'allies' && a.target !== 'enemies') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid supportAura target' })
    if (a.targetTags !== undefined && (!Array.isArray(a.targetTags) || a.targetTags.some(t => typeof t !== 'string'))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid supportAura targetTags' })
    validateDeepNode(a, ctx, `supportAuras[${i}]`)
  }
}

export function validateBurrowConfig(c: unknown, ctx: z.RefinementCtx): void {
  if (!isObj(c)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'burrowConfig must be an object' }); return }
  for (const k of Object.keys(c)) if (!CANONICAL_BURROW_CONFIG_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed burrowConfig key: ${k}` })
  if (c.damageReduction === undefined || !checkFinite(c.damageReduction)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid numeric value for burrowConfig damageReduction' })
  for (const f of ['regenPercentPerTick', 'emergeAttackMult', 'emergeAoeRadiusAdd'] as const) {
    if (c[f] !== undefined && !checkFinite(c[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for burrowConfig ${f}` })
  }
  validateDeepNode(c, ctx, 'burrowConfig')
}


export function validateAbilityProgramItem(p: unknown, ctx: z.RefinementCtx, field: string): void {
  if (!isObj(p)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid item in ${field}: expected object` })
    return
  }
  for (const k of Object.keys(p)) {
    if (!ABILITY_PROGRAM_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed ability program key in ${field}: ${k}` })
  }
  if (typeof p.id !== 'string' || !p.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ability program id in ${field}` })
  if (p.priority !== undefined && !checkFinite(p.priority)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric priority in ${field}` })
  if (!isObj(p.trigger)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ability program trigger in ${field}` })
  } else {
    for (const k of Object.keys(p.trigger)) {
      if (!ABILITY_TRIGGER_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed trigger key in ${field}: ${k}` })
    }
    const kinds = new Set(['weapon_attack', 'post_weapon_attack', 'projectile_impact', 'hit', 'periodic'])
    if (typeof p.trigger.kind !== 'string' || !kinds.has(p.trigger.kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid trigger kind in ${field}` })
    if (p.trigger.kind === 'periodic' && (!checkFinite(p.trigger.intervalTicks) || (p.trigger.intervalTicks as number) <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid intervalTicks in ${field}.trigger` })
    }
  }
  if (!Array.isArray(p.groups) || p.groups.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid groups in ${field}` })
  } else {
    for (let gi = 0; gi < p.groups.length; gi++) {
      const g = p.groups[gi]
      if (!isObj(g)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid group at ${field}.groups[${gi}]` })
        continue
      }
      for (const k of Object.keys(g)) if (!ABILITY_GROUP_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed group key: ${k}` })
      if (!isObj(g.selector) || typeof g.selector.kind !== 'string') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid selector in ${field}.groups[${gi}]` })
      } else {
        if (!VALID_SELECTOR_KINDS.has(g.selector.kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid selector kind: ${g.selector.kind}` })
        for (const k of Object.keys(g.selector)) if (!ABILITY_SELECTOR_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed selector key: ${k}` })
        if (g.selector.radius !== undefined && (!checkFinite(g.selector.radius) || (g.selector.radius as number) <= 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid selector radius' })
        if (g.selector.maxTargets !== undefined && (!checkFinite(g.selector.maxTargets) || (g.selector.maxTargets as number) <= 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid selector maxTargets' })
      }
      if (!Array.isArray(g.effects)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid effects in ${field}.groups[${gi}]` })
      } else {
        for (let ei = 0; ei < g.effects.length; ei++) {
          const eff = g.effects[ei]
          validateAbilityEffect(eff, ctx, `${field}.groups[${gi}].effects[${ei}]`)
          validateDeepNode(eff, ctx, `${field}.groups[${gi}].effects[${ei}]`)
        }
      }
    }
  }
}

const OBJ_NUMERIC_REQUIREMENTS: Record<string, readonly string[]> = {
  flatDamageBlock: ['amount'],
  shieldHitBlock: ['charges'],
  statGrowth: ['intervalTicks', 'maxStacks'],
  attackCharge: ['intervalTicks', 'maxStacks', 'attackMultPerStack'],
  spawnerConfig: ['interval', 'timer'],
  reassemblyConfig: ['delayTicks'],
  reassemblyState: ['remainingTicks', 'hpPercent'],
}

export function validateSnapshotObjectField(field: string, obj: unknown, ctx: z.RefinementCtx): void {
  if (!isObj(obj)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid object for ${field}` })
    return
  }
  if (field === 'burrowConfig') {
    validateBurrowConfig(obj, ctx)
    return
  }
  if (field === 'formationModifiers') {
    validateFormationModifiers(obj, ctx, field)
    return
  }
  if (field === 'rankScaling') {
    validateRankScaling(obj, ctx, field)
    return
  }
  if (GEOMETRY_CONFIG_SPECS[field]) {
    validateGeometryConfig(field, obj, ctx, field)
    return
  }
  const allowed = SNAPSHOT_OBJ_ALLOWED_KEY_SETS[field]
  if (allowed) {
    for (const k of Object.keys(obj)) {
      if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed ${field} key: ${k}` })
    }
  }
  const reqs = OBJ_NUMERIC_REQUIREMENTS[field]
  if (reqs) {
    for (const prop of reqs) {
      if (obj[prop] === undefined || !checkFinite(obj[prop])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${field}.${prop}` })
      }
    }
  }
  validateDeepNode(obj, ctx, field)
}

export function validateSnapshotArrayField(field: string, arr: unknown, ctx: z.RefinementCtx): void {
  if (!Array.isArray(arr)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid array for ${field}` })
    return
  }
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (!isObj(item)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid item in ${field}[${i}]: expected object` })
      continue
    }
    if (field === 'abilityPrograms' || field === 'supportPrograms' || field === 'periodicPrograms') {
      validateAbilityProgramItem(item, ctx, `${field}[${i}]`)
    } else if (field === 'statusOnHit') {
      validateStatusEffectItem(item, ctx, `${field}[${i}]`)
    } else if (field === 'fieldEffect') {
      validateFieldEffectItem(item, ctx, `${field}[${i}]`)
      validateDeepNode(item, ctx, `${field}[${i}]`)
    } else if (field === 'triggerEffects') {
      validateTriggerEffectItem(item, ctx, `${field}[${i}]`)
      validateDeepNode(item, ctx, `${field}[${i}]`)
    } else if (field === 'periodicAbilities' || field === 'periodicProgramState') {
      validatePeriodicAbilityItem(item, ctx, `${field}[${i}]`)
      validateDeepNode(item, ctx, `${field}[${i}]`)
    } else {
      const allowed = SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS[field]
      if (allowed) {
        for (const k of Object.keys(item)) {
          if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed ${field} key: ${k}` })
        }
      }
      validateDeepNode(item, ctx, `${field}[${i}]`)
    }
  }
}


import { z } from 'zod'
import {
  CANONICAL_SUPPORT_AURA_KEY_SET,
  CANONICAL_BURROW_CONFIG_KEY_SET,
  CANONICAL_STATUS_EFFECT_KEY_SET,
} from './replay.inventory.js'

export const checkFinite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateDeepNode(node: unknown, ctx: z.RefinementCtx, path: string): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const it = node[i]
      if (it === null || it === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed null/undefined in ${path}[${i}]` })
      } else if (typeof it === 'number' && !Number.isFinite(it)) {
        const target = path.startsWith('details') ? 'details' : `${path}[${i}]`
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in ${target}` })
      } else if (typeof it === 'object') {
        validateDeepNode(it, ctx, `${path}[${i}]`)
      }
    }
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) {
        const target = path.startsWith('details') ? 'details' : path
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed private key in ${target}: ${k}` })
      }
      if (typeof v === 'number' && !Number.isFinite(v)) {
        const target = path.startsWith('details') ? 'details' : path
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid number in ${target}: ${k}` })
      } else if (typeof v === 'object' && v !== null) {
        validateDeepNode(v, ctx, `${path}.${k}`)
      }
    }
  }
}

export function validateSupportAuras(auras: unknown, ctx: z.RefinementCtx): void {
  if (!Array.isArray(auras)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'supportAuras must be an array' })
    return
  }
  for (let i = 0; i < auras.length; i++) {
    const a = auras[i]
    if (!isObj(a) || typeof a.type !== 'string' || !a.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid supportAura item at [${i}]` })
      continue
    }
    for (const k of Object.keys(a)) {
      if (!CANONICAL_SUPPORT_AURA_KEY_SET.has(k)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed supportAura key: ${k}` })
      }
    }
    for (const f of ['radius', 'value', 'duration', 'interval'] as const) {
      if (a[f] !== undefined && !checkFinite(a[f])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for supportAura ${f}` })
      }
    }
    if (a.target !== undefined && a.target !== 'allies' && a.target !== 'enemies') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid supportAura target' })
    }
    if (a.targetTags !== undefined && (!Array.isArray(a.targetTags) || a.targetTags.some(t => typeof t !== 'string'))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid supportAura targetTags' })
    }
    validateDeepNode(a, ctx, `supportAuras[${i}]`)
  }
}

export function validateAbilityProgramItem(p: unknown, ctx: z.RefinementCtx, field: string): void {
  if (!isObj(p)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid item in ${field}: expected object` })
    return
  }
  if (typeof p.id !== 'string' || !p.id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ability program id in ${field}` })
  }
  if (!isObj(p.trigger) || typeof p.trigger.kind !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ability program trigger in ${field}` })
  }
  if (p.priority !== undefined && !checkFinite(p.priority)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric priority in ${field}` })
  }
  if (p.groups !== undefined && !Array.isArray(p.groups)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid groups in ${field}` })
  }
  validateDeepNode(p, ctx, field)
}

export function validateBurrowConfig(c: unknown, ctx: z.RefinementCtx): void {
  if (!isObj(c)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'burrowConfig must be an object' })
    return
  }
  for (const k of Object.keys(c)) {
    if (!CANONICAL_BURROW_CONFIG_KEY_SET.has(k)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed burrowConfig key: ${k}` })
    }
  }
  if (c.damageReduction === undefined || !checkFinite(c.damageReduction)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid numeric value for burrowConfig damageReduction' })
  }
  for (const f of ['regenPercentPerTick', 'emergeAttackMult', 'emergeAoeRadiusAdd'] as const) {
    if (c[f] !== undefined && !checkFinite(c[f])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for burrowConfig ${f}` })
    }
  }
  validateDeepNode(c, ctx, 'burrowConfig')
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
      if (typeof item.type !== 'string' || !item.type) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusOnHit type at [${i}]` })
      }
      for (const k of Object.keys(item)) {
        if (!CANONICAL_STATUS_EFFECT_KEY_SET.has(k)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed statusOnHit key: ${k}` })
        }
      }
      validateDeepNode(item, ctx, `${field}[${i}]`)
    } else {
      validateDeepNode(item, ctx, `${field}[${i}]`)
    }
  }
}

export function validateSnapshotObjectField(field: string, obj: unknown, ctx: z.RefinementCtx): void {
  if (!isObj(obj)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid object for ${field}` })
    return
  }
  if (field === 'burrowConfig') {
    validateBurrowConfig(obj, ctx)
  } else {
    validateDeepNode(obj, ctx, field)
  }
}

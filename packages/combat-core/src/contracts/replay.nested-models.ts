import { z } from 'zod'
import {
  CANONICAL_STATUS_EFFECT_KEY_SET,
  CANONICAL_TARGET_MARK_KEY_SET,
  SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS,
} from './replay.inventory.js'

export const checkFinite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
export const checkPosNum = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v > 0
export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const GEOMETRY_KIND_TO_CANONICAL: Record<string, string> = {
  line_pierce: 'linePierce', linePierce: 'linePierce', cone_attack: 'coneAttack', coneAttack: 'coneAttack',
  beam_attack: 'beamAttack', beamAttack: 'beamAttack', barrage_attack: 'barrageAttack', barrageAttack: 'barrageAttack',
  chain_attack: 'chainAttack', chainAttack: 'chainAttack', split_fire: 'splitFire', splitFire: 'splitFire',
  side_weapon: 'sideWeapon', sideWeapon: 'sideWeapon', sweep_attack: 'sweepAttack', sweepAttack: 'sweepAttack',
  conditional_attack_mode: 'conditionalAttackMode', conditionalAttackMode: 'conditionalAttackMode',
}

export const GEOMETRY_CONFIG_SPECS: Record<string, { reqNum: readonly string[]; optNum?: readonly string[]; optBool?: readonly string[] }> = {
  linePierce: { reqNum: ['width', 'damageMultiplier'], optNum: ['maxTargets'] }, coneAttack: { reqNum: ['angleDeg', 'damageMultiplier'], optNum: ['maxTargets'] },
  beamAttack: { reqNum: ['width', 'damageMultiplier'], optNum: ['maxTargets'] }, barrageAttack: { reqNum: ['impacts', 'radius', 'spreadRadius', 'damageMultiplier'], optNum: ['maxTargetsPerImpact', 'impactIntervalTicks'] },
  chainAttack: { reqNum: ['jumps', 'radius', 'damageMultiplier'], optNum: ['falloff'] }, splitFire: { reqNum: ['maxTargets', 'damageMultiplier'], optNum: ['range'], optBool: ['canTargetAir', 'allowMinimumDamage'] },
  sideWeapon: { reqNum: ['damage', 'range', 'maxTargets'], optBool: ['canTargetAir'] }, sweepAttack: { reqNum: ['width', 'damageMultiplier'], optNum: ['maxTargets', 'sizeBonusMultiplier'] },
  conditionalAttackMode: { reqNum: ['minTargets', 'radius', 'damageMultiplier'] },
}

export const STATUS_STR_FIELDS = ['type', 'sourceId', 'sourceUnitId', 'sourceUpgradeId', 'stackKey', 'controlMode', 'sourceUnitType', 'sourceTeam', 'damageType'] as const
export const STATUS_NUM_FIELDS = ['duration', 'value', 'tickInterval', 'nextTickIn', 'maxStacks', 'elapsedTicks', 'appliedAtTick', 'shieldAmount'] as const
export const VALID_SELECTOR_KINDS = new Set(['primary_target', 'self', 'area_at_target', 'area_at_impact'])
export const VALID_DAMAGE_EXPR_KINDS = new Set(['fixed', 'attack_multiplier'])
export const VALID_TRIGGER_KINDS = new Set(['weapon_attack', 'post_weapon_attack', 'projectile_impact', 'hit', 'periodic'])
export const VALID_EFFECT_KINDS = new Set(['damage', 'apply_status', 'displace', 'support_aura', 'periodic_payload', 'split_fire', 'chain_attack', 'side_weapon', 'barrage_attack', 'line_pierce', 'cone_attack', 'beam_attack', 'mark_target', 'legacy_geometry'])


export function validateGeometryConfig(kind: string, cfg: unknown, ctx: z.RefinementCtx, path: string): void {
  const canonical = GEOMETRY_KIND_TO_CANONICAL[kind]
  if (!canonical || !GEOMETRY_CONFIG_SPECS[canonical]) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown geometry config kind: ${kind} at ${path}` }); return }
  if (!isObj(cfg)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Geometry config must be object at ${path}` }); return }
  const spec = GEOMETRY_CONFIG_SPECS[canonical]
  const allowed = new Set([...spec.reqNum, ...(spec.optNum ?? []), ...(spec.optBool ?? [])])
  for (const k of Object.keys(cfg)) if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed ${canonical} key: ${k}` })
  for (const f of spec.reqNum) if (cfg[f] === undefined || !checkFinite(cfg[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  for (const f of spec.optNum ?? []) if (cfg[f] !== undefined && !checkFinite(cfg[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  for (const f of spec.optBool ?? []) if (cfg[f] !== undefined && typeof cfg[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${path}.${f}` })
}

export function validateStatusEffectItem(s: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(s)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffect at ${path}` }); return }
  if (typeof s.type !== 'string' || !s.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid status type at ${path}` })
  if (!checkFinite(s.duration) || (s.duration as number) < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid status duration at ${path}` })
  for (const k of Object.keys(s)) if (!CANONICAL_STATUS_EFFECT_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed statusEffect key: ${k}` })
  for (const sf of STATUS_STR_FIELDS) if (s[sf] !== undefined && typeof s[sf] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffect ${sf}: expected string` })
  for (const nf of STATUS_NUM_FIELDS) if (s[nf] !== undefined && !checkFinite(s[nf])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffect ${nf}` })
}

export function validateFormationModifiers(fm: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(fm)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid formationModifiers at ${path}` }); return }
  for (const k of Object.keys(fm)) if (k !== 'spacingMultiplier' && k !== 'adjacencyBonus') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed key in ${path}: ${k}` })
  if (fm.spacingMultiplier !== undefined && !checkFinite(fm.spacingMultiplier)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid spacingMultiplier at ${path}` })
  if (fm.adjacencyBonus !== undefined) {
    if (!isObj(fm.adjacencyBonus)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid adjacencyBonus at ${path}` }); return }
    const adjKeys = new Set(['radius', 'maxStacks', 'damageReductionPerAlly', 'rangeBoostPerAlly', 'attackBoostPerAlly'])
    for (const k of Object.keys(fm.adjacencyBonus)) if (!adjKeys.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed key in ${path}.adjacencyBonus: ${k}` })
    if (!checkFinite(fm.adjacencyBonus.radius) || !checkFinite(fm.adjacencyBonus.maxStacks)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid radius/maxStacks in ${path}.adjacencyBonus` })
    for (const f of ['damageReductionPerAlly', 'rangeBoostPerAlly', 'attackBoostPerAlly'] as const) if (fm.adjacencyBonus[f] !== undefined && !checkFinite(fm.adjacencyBonus[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.adjacencyBonus.${f}` })
  }
}

export function validateRankScaling(rs: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(rs)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid rankScaling at ${path}` }); return }
  const allowed = new Set(['hpMultPerRank', 'attackMultPerRank', 'defenseAddPerRank', 'rangeAddPerRank', 'cooldownReductionPerRank', 'damageModifiers'])
  for (const k of Object.keys(rs)) if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed key in ${path}: ${k}` })
  for (const f of ['hpMultPerRank', 'attackMultPerRank', 'defenseAddPerRank', 'rangeAddPerRank', 'cooldownReductionPerRank'] as const) if (rs[f] !== undefined && !checkFinite(rs[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  if (rs.damageModifiers !== undefined) {
    if (!Array.isArray(rs.damageModifiers)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `damageModifiers must be array at ${path}` }); return }
    for (let i = 0; i < rs.damageModifiers.length; i++) {
      const dm = rs.damageModifiers[i]
      if (!isObj(dm)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid damageModifier at ${path}[${i}]` }); continue }
      for (const k of Object.keys(dm)) if (k !== 'relation' && k !== 'multiplier') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed key in ${path}.damageModifiers[${i}]: ${k}` })
      if (typeof dm.relation !== 'string' || !['same_rank', 'higher_rank', 'lower_rank'].includes(dm.relation)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid relation at ${path}[${i}]` })
      if (!checkFinite(dm.multiplier)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid multiplier at ${path}[${i}]` })
    }
  }
}

export function validatePercentHp(php: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(php) || !checkFinite(php.percent) || (php.percent as number) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid percentHp at ${path}` }); return
  }
  if (php.basis !== undefined && php.basis !== 'max' && php.basis !== 'current') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid basis at ${path}` })
  for (const f of ['maxBonus', 'minBonus'] as const) if (php[f] !== undefined && !checkFinite(php[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
  for (const k of Object.keys(php)) if (!['percent', 'basis', 'maxBonus', 'minBonus'].includes(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed percentHp key: ${k} at ${path}` })
}

export function validateFieldEffectItem(fe: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(fe)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid fieldEffect at ${path}` }); return }
  if (typeof fe.id !== 'string' || !fe.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid fieldEffect id at ${path}` })
  if (typeof fe.kind !== 'string' || !['barrier_dome', 'cleanse_field', 'hazard_field'].includes(fe.kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid fieldEffect kind at ${path}` })
  if (!checkFinite(fe.radius) || (fe.radius as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid fieldEffect radius at ${path}` })
  if (!checkFinite(fe.intervalTicks) || (fe.intervalTicks as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid fieldEffect intervalTicks at ${path}` })
  for (const f of ['initialDelayTicks', 'duration', 'value', 'capacity', 'damagePerTick', 'nextTick'] as const) {
    if (fe[f] !== undefined && !checkFinite(fe[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  }
  if (fe.hazardType !== undefined && typeof fe.hazardType !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid hazardType at ${path}` })
  if (fe.hazardTypes !== undefined && (!Array.isArray(fe.hazardTypes) || fe.hazardTypes.some(t => typeof t !== 'string'))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid hazardTypes at ${path}` })
  if (fe.statusEffects !== undefined) {
    if (!Array.isArray(fe.statusEffects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `statusEffects must be array at ${path}` })
    else for (let i = 0; i < fe.statusEffects.length; i++) validateStatusEffectItem(fe.statusEffects[i], ctx, `${path}.statusEffects[${i}]`)
  }
  const allowed = SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS.fieldEffect
  for (const k of Object.keys(fe)) if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed fieldEffect key: ${k} at ${path}` })
}

export function validateTriggerPayload(p: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(p) || typeof p.kind !== 'string') { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid trigger payload at ${path}` }); return }
  const validKinds = new Set(['status', 'shield', 'heal', 'damage', 'spawn', 'field', 'delayed_reassembly', 'cooldown_reset'])
  if (!validKinds.has(p.kind)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid trigger payload kind: ${p.kind} at ${path}` }); return }
  if (typeof p.target !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid trigger target at ${path}` })
  if (p.kind === 'status') validateStatusEffectItem(p.status, ctx, `${path}.status`)
  else if (p.kind === 'shield' && !checkFinite(p.amount)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid shield amount at ${path}` })
  else if (p.kind === 'heal') {
    for (const f of ['amount', 'percentMaxHp', 'victimMaxHpPercent'] as const) if (p[f] !== undefined && !checkFinite(p[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
  } else if (p.kind === 'damage') {
    if (p.amount !== undefined && !checkFinite(p.amount)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid damage amount at ${path}` })
    if (p.radius !== undefined && !checkFinite(p.radius)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid radius at ${path}` })
    if (p.percentHp !== undefined) validatePercentHp(p.percentHp, ctx, `${path}.percentHp`)
  } else if (p.kind === 'spawn') {
    if (typeof p.unitType !== 'string' || !p.unitType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid unitType at ${path}` })
    for (const f of ['count', 'cap', 'hpPercent'] as const) if (p[f] !== undefined && !checkFinite(p[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
  } else if (p.kind === 'field') validateFieldEffectItem(p.field, ctx, `${path}.field`)
  else if (p.kind === 'delayed_reassembly') {
    if (!checkFinite(p.delayTicks)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid delayTicks at ${path}` })
    if (p.hpPercent !== undefined && !checkFinite(p.hpPercent)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid hpPercent at ${path}` })
  }
  const baseKeys = new Set(['kind', 'target', 'status', 'amount', 'percentMaxHp', 'victimMaxHpPercent', 'percentHp', 'radius', 'unitType', 'count', 'cap', 'hpPercent', 'field', 'delayTicks'])
  for (const k of Object.keys(p)) if (!baseKeys.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed trigger payload key: ${k} at ${path}` })
}

export function validatePeriodicPayload(p: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(p) || typeof p.kind !== 'string') { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid periodic payload at ${path}` }); return }
  const validKinds = new Set(['damage', 'status', 'hazard', 'shield', 'heal', 'spawn', 'mark'])
  if (!validKinds.has(p.kind)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid periodic payload kind: ${p.kind} at ${path}` }); return }
  if (p.kind === 'damage') {
    if (p.amount !== undefined && !checkFinite(p.amount)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid damage amount at ${path}` })
    if (p.radius !== undefined && !checkFinite(p.radius)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid radius at ${path}` })
    if (p.percentHp !== undefined) validatePercentHp(p.percentHp, ctx, `${path}.percentHp`)
    if (p.statusEffects !== undefined) {
      if (!Array.isArray(p.statusEffects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffects at ${path}` })
      else for (let i = 0; i < p.statusEffects.length; i++) validateStatusEffectItem(p.statusEffects[i], ctx, `${path}.statusEffects[${i}]`)
    }
  } else if (p.kind === 'status') {
    if (!Array.isArray(p.effects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid effects in ${path}` })
    else for (let i = 0; i < p.effects.length; i++) validateStatusEffectItem(p.effects[i], ctx, `${path}.effects[${i}]`)
  } else if (p.kind === 'hazard') {
    if (typeof p.hazardType !== 'string' || !checkFinite(p.radius) || !checkFinite(p.duration)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid hazard params at ${path}` })
    if (p.damagePerTick !== undefined && !checkFinite(p.damagePerTick)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid damagePerTick at ${path}` })
    if (p.statusEffects !== undefined) {
      if (!Array.isArray(p.statusEffects)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid statusEffects at ${path}` })
      else for (let i = 0; i < p.statusEffects.length; i++) validateStatusEffectItem(p.statusEffects[i], ctx, `${path}.statusEffects[${i}]`)
    }
  } else if (p.kind === 'shield') {
    if (!checkFinite(p.amount) || (p.amount as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid shield amount at ${path}` })
  } else if (p.kind === 'heal') {
    for (const f of ['amount', 'percentMaxHp', 'radius'] as const) if (p[f] !== undefined && !checkFinite(p[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
    if (p.cleanse !== undefined && (!Array.isArray(p.cleanse) || p.cleanse.some(c => typeof c !== 'string'))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid cleanse array at ${path}` })
  } else if (p.kind === 'spawn') {
    if (typeof p.unitType !== 'string' || !p.unitType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid unitType at ${path}` })
    for (const f of ['count', 'cap', 'hpPercent', 'spreadRadius'] as const) if (p[f] !== undefined && !checkFinite(p[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
  } else if (p.kind === 'mark') {
    if (!isObj(p.mark) || !checkFinite(p.mark.duration) || (p.mark.duration as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid mark at ${path}` })
    else {
      for (const k of Object.keys(p.mark)) if (!CANONICAL_TARGET_MARK_KEY_SET.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed mark key: ${k} at ${path}.mark` })
      for (const f of ['duration', 'markDuration', 'damageMultiplier', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetLockTicks'] as const) if (p.mark[f] !== undefined && !checkFinite(p.mark[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.mark.${f}` })
      for (const f of ['sharedDamage', 'squadWide'] as const) if (p.mark[f] !== undefined && typeof p.mark[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${path}.mark.${f}` })
      for (const f of ['sourceUnitId', 'squadId', 'retargetPolicy'] as const) if (p.mark[f] !== undefined && typeof p.mark[f] !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid string for ${path}.mark.${f}` })
    }
    if (p.radius !== undefined && !checkFinite(p.radius)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid radius at ${path}` })
  }
  const baseKeys = new Set(['kind', 'amount', 'percentHp', 'radius', 'statusEffects', 'effects', 'hazardType', 'duration', 'damagePerTick', 'cleanse', 'percentMaxHp', 'unitType', 'count', 'cap', 'hpPercent', 'spreadRadius', 'mark'])
  for (const k of Object.keys(p)) if (!baseKeys.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed periodic payload key: ${k} at ${path}` })
}

export function validateAbilityEffect(eff: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(eff) || typeof eff.kind !== 'string' || !VALID_EFFECT_KINDS.has(eff.kind)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid effect kind at ${path}` }); return
  }
  if (eff.kind === 'damage') {
    if (!isObj(eff.expression) || typeof eff.expression.kind !== 'string' || !VALID_DAMAGE_EXPR_KINDS.has(eff.expression.kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid damage expression at ${path}` })
    else {
      for (const k of Object.keys(eff.expression)) if (k !== 'kind' && k !== 'amount' && k !== 'multiplier') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed expr key: ${k} at ${path}` })
      const num = eff.expression.kind === 'fixed' ? eff.expression.amount : eff.expression.multiplier
      if (!checkFinite(num) || (num as number) < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid amount/multiplier at ${path}` })
    }
  } else if (GEOMETRY_KIND_TO_CANONICAL[eff.kind]) {
    validateGeometryConfig(eff.kind, eff.config, ctx, `${path}.config`)
    for (const k of Object.keys(eff)) if (k !== 'kind' && k !== 'config') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed key in ${path}: ${k}` })
  } else if (eff.kind === 'apply_status') {
    if (typeof eff.status !== 'string' || !eff.status) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid status at ${path}` })
    if (!checkFinite(eff.duration)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid status duration at ${path}` })
    if (eff.value !== undefined && !checkFinite(eff.value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid status value at ${path}` })
    if (eff.controlMode !== undefined && !['disable', 'redirect', 'confuse'].includes(eff.controlMode as string)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid controlMode at ${path}` })
    for (const k of Object.keys(eff)) if (!['kind', 'status', 'duration', 'value', 'controlMode'].includes(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed apply_status key: ${k} at ${path}` })
  } else if (eff.kind === 'displace') {
    if (eff.mode !== 'pull' && eff.mode !== 'knockback') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid displace mode at ${path}` })
    if (!checkFinite(eff.radius) || !checkFinite(eff.strength)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid radius/strength at ${path}` })
    if (eff.maxTargets !== undefined && !checkFinite(eff.maxTargets)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid maxTargets at ${path}` })
    for (const k of Object.keys(eff)) if (!['kind', 'mode', 'radius', 'strength', 'maxTargets'].includes(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed displace key: ${k} at ${path}` })
  } else if (eff.kind === 'support_aura') {
    const a = eff.aura as Record<string, unknown>
    if (!isObj(a) || typeof a.type !== 'string' || !checkFinite(a.radius) || !checkFinite(a.value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid support aura at ${path}` })
  } else if (eff.kind === 'periodic_payload') {
    validatePeriodicAbilityItem(eff.ability, ctx, `${path}.ability`)
    for (const k of Object.keys(eff)) if (k !== 'kind' && k !== 'ability') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed periodic_payload key: ${k} at ${path}` })
  } else if (eff.kind === 'mark_target') {
    if (!checkFinite(eff.duration)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid mark duration at ${path}` })
    for (const f of ['damageMultiplier', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetLockTicks'] as const) if (eff[f] !== undefined && !checkFinite(eff[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${f} at ${path}` })
    for (const f of ['sharedDamage', 'squadWide'] as const) if (eff[f] !== undefined && typeof eff[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${path}.${f}` })
    if (eff.retargetPolicy !== undefined && typeof eff.retargetPolicy !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid retargetPolicy at ${path}` })
    for (const k of Object.keys(eff)) if (!['kind', 'duration', 'damageMultiplier', 'executeThreshold', 'sharedDamage', 'squadWide', 'focusPriority', 'focusRadius', 'retargetPolicy', 'retargetLockTicks'].includes(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed mark_target key: ${k} at ${path}` })
  } else if (eff.kind === 'legacy_geometry') {
    if (typeof eff.geometry !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid geometry at ${path}` })
    for (const k of Object.keys(eff)) if (k !== 'kind' && k !== 'geometry') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed legacy_geometry key: ${k} at ${path}` })
  }
}

export function validateTriggerEffectItem(te: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(te)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid trigger effect at ${path}` }); return }
  if (typeof te.id !== 'string' || !te.id || typeof te.event !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid id/event in ${path}` })
  const allowed = SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS.triggerEffects
  for (const k of Object.keys(te)) if (!allowed.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed triggerEffect key: ${k} at ${path}` })
  for (const f of ['threshold', 'count', 'maxTriggers', 'cooldownTicks', 'counter', 'triggersRemaining', 'cooldownRemaining'] as const) if (te[f] !== undefined && !checkFinite(te[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  for (const f of ['repeatable', 'fired'] as const) if (te[f] !== undefined && typeof te[f] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid boolean for ${path}.${f}` })
  validateTriggerPayload(te.payload, ctx, `${path}.payload`)
}

export function validatePeriodicAbilityItem(pa: unknown, ctx: z.RefinementCtx, path: string): void {
  if (!isObj(pa)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid periodic ability at ${path}` }); return }
  if (typeof pa.id !== 'string' || !pa.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid id in ${path}` })
  if (!checkFinite(pa.intervalTicks) || (pa.intervalTicks as number) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid intervalTicks in ${path}` })
  for (const f of ['initialDelayTicks', 'charges', 'chargesRemaining', 'nextTick', 'minRange', 'maxRange'] as const) if (pa[f] !== undefined && !checkFinite(pa[f])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid numeric value for ${path}.${f}` })
  if (pa.targetPolicy !== undefined && typeof pa.targetPolicy !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid targetPolicy in ${path}` })
  if (pa.canTargetAir !== undefined && typeof pa.canTargetAir !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid canTargetAir in ${path}` })
  for (const k of Object.keys(pa)) if (!SNAPSHOT_ARR_ITEM_ALLOWED_KEY_SETS.periodicAbilities.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Disallowed periodic ability key: ${k} in ${path}` })
  validatePeriodicPayload(pa.payload, ctx, `${path}.payload`)
}

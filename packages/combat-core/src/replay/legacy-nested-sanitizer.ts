import {
  checkFinite,
  isObj,
  GEOMETRY_KIND_TO_CANONICAL,
  GEOMETRY_CONFIG_SPECS,
  STATUS_STR_FIELDS,
  STATUS_NUM_FIELDS,
} from '../contracts/replay.nested-models.js'

const STATUS_STR_SET: Set<string> = new Set(STATUS_STR_FIELDS)
const STATUS_NUM_SET: Set<string> = new Set(STATUS_NUM_FIELDS)

export function sanitizeStatusEffect(s: unknown): Record<string, unknown> | undefined {
  if (!isObj(s) || typeof s.type !== 'string' || !s.type) return undefined
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s)) {
    if (k.startsWith('_')) continue
    if (k === 'type') clean.type = v
    else if (STATUS_STR_SET.has(k) && typeof v === 'string') clean[k] = v
    else if (STATUS_NUM_SET.has(k) && checkFinite(v)) clean[k] = v
  }
  return clean
}

export function sanitizeGeometryConfig(kind: string, cfg: unknown): Record<string, unknown> | undefined {
  const canonical = GEOMETRY_KIND_TO_CANONICAL[kind]
  if (!canonical || !GEOMETRY_CONFIG_SPECS[canonical] || !isObj(cfg)) return undefined
  const spec = GEOMETRY_CONFIG_SPECS[canonical]
  const numFields = new Set([...spec.reqNum, ...(spec.optNum ?? [])]), boolFields = new Set(spec.optBool ?? [])
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(cfg)) {
    if (k.startsWith('_')) continue
    if (numFields.has(k) && checkFinite(v)) clean[k] = v
    else if (boolFields.has(k) && typeof v === 'boolean') clean[k] = v
  }
  return clean
}

export function sanitizeDamageExpression(expr: unknown): Record<string, unknown> | undefined {
  if (!isObj(expr) || typeof expr.kind !== 'string') return undefined
  if (expr.kind === 'fixed' && checkFinite(expr.amount)) return { kind: 'fixed', amount: expr.amount }
  if (expr.kind === 'attack_multiplier' && checkFinite(expr.multiplier)) return { kind: 'attack_multiplier', multiplier: expr.multiplier }
  return undefined
}

export function sanitizeTargetSelector(sel: unknown): Record<string, unknown> | undefined {
  if (!isObj(sel) || typeof sel.kind !== 'string') return undefined
  const clean: Record<string, unknown> = { kind: sel.kind }
  if (checkFinite(sel.radius)) clean.radius = sel.radius
  if (checkFinite(sel.maxTargets)) clean.maxTargets = sel.maxTargets
  return clean
}

export function sanitizeAbilityTrigger(trig: unknown): Record<string, unknown> | undefined {
  if (!isObj(trig) || typeof trig.kind !== 'string') return undefined
  return trig.kind === 'periodic' && checkFinite(trig.intervalTicks)
    ? { kind: trig.kind, intervalTicks: trig.intervalTicks }
    : { kind: trig.kind }
}

export function sanitizeSupportAuraItem(a: unknown): Record<string, unknown> | undefined {
  if (!isObj(a) || typeof a.type !== 'string') return undefined
  const clean: Record<string, unknown> = { type: a.type }
  for (const f of ['radius', 'value', 'duration', 'interval'] as const) if (checkFinite(a[f])) clean[f] = a[f]
  if (a.target === 'allies' || a.target === 'enemies') clean.target = a.target
  if (Array.isArray(a.targetTags)) clean.targetTags = a.targetTags.filter(t => typeof t === 'string')
  return clean
}

export function sanitizeAbilityEffect(eff: unknown): Record<string, unknown> | undefined {
  if (!isObj(eff) || typeof eff.kind !== 'string') return undefined
  if (eff.kind === 'damage') { const expr = sanitizeDamageExpression(eff.expression); return expr ? { kind: 'damage', expression: expr } : undefined }
  if (GEOMETRY_KIND_TO_CANONICAL[eff.kind]) { const cfg = sanitizeGeometryConfig(eff.kind, eff.config); return cfg ? { kind: eff.kind, config: cfg } : undefined }
  if (eff.kind === 'apply_status' && typeof eff.status === 'string' && checkFinite(eff.duration)) {
    const clean: Record<string, unknown> = { kind: 'apply_status', status: eff.status, duration: eff.duration }
    if (checkFinite(eff.value)) clean.value = eff.value
    if (typeof eff.controlMode === 'string') clean.controlMode = eff.controlMode
    return clean
  }
  if (eff.kind === 'displace' && (eff.mode === 'pull' || eff.mode === 'knockback') && checkFinite(eff.radius) && checkFinite(eff.strength)) {
    const clean: Record<string, unknown> = { kind: 'displace', mode: eff.mode, radius: eff.radius, strength: eff.strength }
    if (checkFinite(eff.maxTargets)) clean.maxTargets = eff.maxTargets
    return clean
  }
  if (eff.kind === 'support_aura') { const a = sanitizeSupportAuraItem(eff.aura); return a ? { kind: 'support_aura', aura: a } : undefined }
  if (eff.kind === 'periodic_payload') { const pa = sanitizePeriodicAbilityItem(eff.ability); return pa ? { kind: 'periodic_payload', ability: pa } : undefined }
  if (eff.kind === 'mark_target' && checkFinite(eff.duration)) {
    const clean: Record<string, unknown> = { kind: 'mark_target', duration: eff.duration }
    for (const f of ['damageMultiplier', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetLockTicks'] as const) if (checkFinite(eff[f])) clean[f] = eff[f]
    for (const f of ['sharedDamage', 'squadWide'] as const) if (typeof eff[f] === 'boolean') clean[f] = eff[f]
    if (typeof eff.retargetPolicy === 'string') clean.retargetPolicy = eff.retargetPolicy
    return clean
  }
  if (eff.kind === 'legacy_geometry' && typeof eff.geometry === 'string') return { kind: 'legacy_geometry', geometry: eff.geometry }
  return undefined
}

export function sanitizeAbilityPrograms(programs: unknown): unknown {
  if (!Array.isArray(programs)) return programs
  return programs.map(p => {
    if (!isObj(p) || typeof p.id !== 'string') return p
    const clean: Record<string, unknown> = { id: p.id }
    if (checkFinite(p.priority)) clean.priority = p.priority
    if (isObj(p.trigger)) { const t = sanitizeAbilityTrigger(p.trigger); if (t) clean.trigger = t }
    if (Array.isArray(p.groups)) {
      clean.groups = p.groups.map(g => {
        if (!isObj(g)) return g
        const grp: Record<string, unknown> = {}
        if (isObj(g.selector)) { const s = sanitizeTargetSelector(g.selector); if (s) grp.selector = s }
        if (Array.isArray(g.effects)) grp.effects = g.effects.map(sanitizeAbilityEffect).filter(Boolean)
        return grp
      })
    }
    return clean
  })
}

export function sanitizeFormationModifiers(fm: unknown): Record<string, unknown> | undefined {
  if (!isObj(fm)) return undefined
  const clean: Record<string, unknown> = {}
  if (checkFinite(fm.spacingMultiplier)) clean.spacingMultiplier = fm.spacingMultiplier
  if (isObj(fm.adjacencyBonus) && checkFinite(fm.adjacencyBonus.radius) && checkFinite(fm.adjacencyBonus.maxStacks)) {
    const ab: Record<string, unknown> = { radius: fm.adjacencyBonus.radius, maxStacks: fm.adjacencyBonus.maxStacks }
    for (const f of ['damageReductionPerAlly', 'rangeBoostPerAlly', 'attackBoostPerAlly'] as const) if (checkFinite(fm.adjacencyBonus[f])) ab[f] = fm.adjacencyBonus[f]
    clean.adjacencyBonus = ab
  }
  return clean
}

export function sanitizeRankScaling(rs: unknown): Record<string, unknown> | undefined {
  if (!isObj(rs)) return undefined
  const clean: Record<string, unknown> = {}
  for (const f of ['hpMultPerRank', 'attackMultPerRank', 'defenseAddPerRank', 'rangeAddPerRank', 'cooldownReductionPerRank'] as const) if (checkFinite(rs[f])) clean[f] = rs[f]
  if (Array.isArray(rs.damageModifiers)) {
    clean.damageModifiers = rs.damageModifiers
      .filter((m): m is Record<string, unknown> => isObj(m) && typeof m.relation === 'string' && checkFinite(m.multiplier))
      .map(m => ({ relation: m.relation, multiplier: m.multiplier }))
  }
  return clean
}

export function sanitizeFieldEffectItem(fe: unknown): Record<string, unknown> | undefined {
  if (!isObj(fe) || typeof fe.id !== 'string' || typeof fe.kind !== 'string') return undefined
  if (!checkFinite(fe.radius) || !checkFinite(fe.intervalTicks)) return undefined
  const clean: Record<string, unknown> = { id: fe.id, kind: fe.kind, radius: fe.radius, intervalTicks: fe.intervalTicks }
  for (const f of ['initialDelayTicks', 'duration', 'value', 'capacity', 'damagePerTick', 'nextTick'] as const) if (checkFinite(fe[f])) clean[f] = fe[f]
  if (typeof fe.hazardType === 'string') clean.hazardType = fe.hazardType
  if (Array.isArray(fe.hazardTypes)) clean.hazardTypes = fe.hazardTypes.filter(t => typeof t === 'string')
  if (Array.isArray(fe.statusEffects)) clean.statusEffects = fe.statusEffects.map(sanitizeStatusEffect).filter(Boolean)
  return clean
}

export function sanitizeTargetMark(m: unknown): Record<string, unknown> | undefined {
  if (!isObj(m) || !checkFinite(m.duration)) return undefined
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(m)) {
    if (k.startsWith('_')) continue
    if (['duration', 'markDuration', 'damageMultiplier', 'executeThreshold', 'focusPriority', 'focusRadius', 'retargetLockTicks'].includes(k) && checkFinite(v)) clean[k] = v
    else if ((k === 'sharedDamage' || k === 'squadWide') && typeof v === 'boolean') clean[k] = v
    else if (['sourceUnitId', 'squadId', 'retargetPolicy'].includes(k) && typeof v === 'string') clean[k] = v
  }
  return clean
}

function sanitizePercentHp(php: unknown): Record<string, unknown> | undefined {
  if (!isObj(php) || !checkFinite(php.percent) || (php.percent as number) <= 0) return undefined
  const clean: Record<string, unknown> = { percent: php.percent }
  if (php.basis === 'max' || php.basis === 'current') clean.basis = php.basis
  if (checkFinite(php.maxBonus)) clean.maxBonus = php.maxBonus
  if (checkFinite(php.minBonus)) clean.minBonus = php.minBonus
  return clean
}

export function sanitizeTriggerPayload(p: unknown): Record<string, unknown> | undefined {
  if (!isObj(p) || typeof p.kind !== 'string' || typeof p.target !== 'string') return undefined
  const clean: Record<string, unknown> = { kind: p.kind, target: p.target }
  if (p.kind === 'status') { const st = sanitizeStatusEffect(p.status); if (st) clean.status = st }
  else if (p.kind === 'shield') { if (checkFinite(p.amount)) clean.amount = p.amount }
  else if (p.kind === 'heal') { for (const f of ['amount', 'percentMaxHp', 'victimMaxHpPercent'] as const) if (checkFinite(p[f])) clean[f] = p[f] }
  else if (p.kind === 'damage') {
    if (checkFinite(p.amount)) clean.amount = p.amount
    if (checkFinite(p.radius)) clean.radius = p.radius
    if (p.percentHp) { const php = sanitizePercentHp(p.percentHp); if (php) clean.percentHp = php }
  } else if (p.kind === 'spawn' && typeof p.unitType === 'string') {
    clean.unitType = p.unitType
    for (const f of ['count', 'cap', 'hpPercent'] as const) if (checkFinite(p[f])) clean[f] = p[f]
  } else if (p.kind === 'field') { const fe = sanitizeFieldEffectItem(p.field); if (fe) clean.field = fe }
  else if (p.kind === 'delayed_reassembly' && checkFinite(p.delayTicks)) {
    clean.delayTicks = p.delayTicks; if (checkFinite(p.hpPercent)) clean.hpPercent = p.hpPercent
  }
  return clean
}

export function sanitizeTriggerEffectItem(te: unknown): Record<string, unknown> | undefined {
  if (!isObj(te) || typeof te.id !== 'string' || typeof te.event !== 'string') return undefined
  const payload = sanitizeTriggerPayload(te.payload)
  if (!payload) return undefined
  const clean: Record<string, unknown> = { id: te.id, event: te.event, payload }
  for (const f of ['threshold', 'count', 'maxTriggers', 'cooldownTicks', 'counter', 'triggersRemaining', 'cooldownRemaining'] as const) if (checkFinite(te[f])) clean[f] = te[f]
  if (typeof te.repeatable === 'boolean') clean.repeatable = te.repeatable
  if (typeof te.fired === 'boolean') clean.fired = te.fired
  return clean
}

export function sanitizePeriodicPayload(p: unknown): Record<string, unknown> | undefined {
  if (!isObj(p) || typeof p.kind !== 'string') return undefined
  const validKinds = new Set(['damage', 'status', 'hazard', 'shield', 'heal', 'spawn', 'mark'])
  if (!validKinds.has(p.kind)) return undefined
  const clean: Record<string, unknown> = { kind: p.kind }
  if (p.kind === 'damage') {
    if (checkFinite(p.amount)) clean.amount = p.amount
    if (checkFinite(p.radius)) clean.radius = p.radius
    if (p.percentHp) { const php = sanitizePercentHp(p.percentHp); if (php) clean.percentHp = php }
    if (Array.isArray(p.statusEffects)) clean.statusEffects = p.statusEffects.map(sanitizeStatusEffect).filter(Boolean)
  } else if (p.kind === 'status' && Array.isArray(p.effects)) {
    clean.effects = p.effects.map(sanitizeStatusEffect).filter(Boolean)
  } else if (p.kind === 'hazard') {
    if (typeof p.hazardType !== 'string' || !checkFinite(p.radius) || !checkFinite(p.duration)) return undefined
    clean.hazardType = p.hazardType; clean.radius = p.radius; clean.duration = p.duration
    if (checkFinite(p.damagePerTick)) clean.damagePerTick = p.damagePerTick
    if (Array.isArray(p.statusEffects)) clean.statusEffects = p.statusEffects.map(sanitizeStatusEffect).filter(Boolean)
  } else if (p.kind === 'shield') {
    if (!checkFinite(p.amount) || (p.amount as number) <= 0) return undefined
    clean.amount = p.amount
  } else if (p.kind === 'heal') {
    for (const f of ['amount', 'percentMaxHp', 'radius'] as const) if (checkFinite(p[f])) clean[f] = p[f]
    if (Array.isArray(p.cleanse)) clean.cleanse = p.cleanse.filter(c => typeof c === 'string')
  } else if (p.kind === 'spawn') {
    if (typeof p.unitType !== 'string') return undefined
    clean.unitType = p.unitType
    for (const f of ['count', 'cap', 'hpPercent', 'spreadRadius'] as const) if (checkFinite(p[f])) clean[f] = p[f]
  } else if (p.kind === 'mark') {
    if (checkFinite(p.radius)) clean.radius = p.radius
    const mk = sanitizeTargetMark(p.mark); if (!mk) return undefined
    clean.mark = mk
  }
  return clean
}

export function sanitizePeriodicAbilityItem(pa: unknown): Record<string, unknown> | undefined {
  if (!isObj(pa) || typeof pa.id !== 'string' || !checkFinite(pa.intervalTicks)) return undefined
  const payload = sanitizePeriodicPayload(pa.payload)
  if (!payload) return undefined
  const clean: Record<string, unknown> = { id: pa.id, intervalTicks: pa.intervalTicks, payload }
  for (const f of ['initialDelayTicks', 'charges', 'chargesRemaining', 'nextTick', 'minRange', 'maxRange'] as const) if (checkFinite(pa[f])) clean[f] = pa[f]
  if (typeof pa.targetPolicy === 'string') clean.targetPolicy = pa.targetPolicy
  if (typeof pa.canTargetAir === 'boolean') clean.canTargetAir = pa.canTargetAir
  return clean
}

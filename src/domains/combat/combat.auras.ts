import type { BattleAction } from './combat.actions'
import type { SimUnit, SupportAura } from './combat.sim.types'
import { applyStatus, cleanseStatuses, HARMFUL_STATUS_TYPES } from './combat.status'
import { getEffectiveCombatTags } from './combat.targeting-score'
export { getUnitSupportAuras } from './combat.support-aura-config'
import { getDistance } from './combat.utils'
import type { SpatialHash } from './spatial-hash'

const DEFAULT_AURA_INTERVAL = 10

/**
 * Processes deterministic support auras for one simulation tick.
 * @param tick Current simulation tick
 * @param units All simulation units
 * @param actions Replay action sink
 */
export function processSupportAuras(tick: number, units: SimUnit[], actions: BattleAction[], spatialHash?: SpatialHash): void {
  const sources = units
    .filter(unit => !unit.isDead && unit.supportAuras && unit.supportAuras.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const source of sources) {
    for (const aura of source.supportAuras ?? []) {
      const interval = aura.interval ?? DEFAULT_AURA_INTERVAL
      if (interval > 1 && tick % interval !== 0) continue

      const candidates = spatialHash?.query(source.x, source.y, aura.radius) ?? units
      const targets = getAuraTargets(source, aura, candidates)
      for (const target of targets) applyAura(source, target, aura, actions)
    }
  }
}

function getAuraTargets(source: SimUnit, aura: SupportAura, units: SimUnit[]): SimUnit[] {
  return units
    .filter(unit => isAuraTarget(source, unit, aura))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function isAuraTarget(source: SimUnit, target: SimUnit, aura: SupportAura): boolean {
  if (target.isDead || target.id === source.id) return false
  if (aura.target === 'allies' && target.team !== source.team) return false
  if (aura.target === 'enemies' && target.team === source.team) return false
  if (!matchesAuraTags(target, aura)) return false
  return getDistance(source.x, source.y, target.x, target.y) <= aura.radius
}

function matchesAuraTags(target: SimUnit, aura: SupportAura): boolean {
  if (!aura.targetTags || aura.targetTags.length === 0) return true
  const targetTags = new Set(getEffectiveCombatTags(target))
  return aura.targetTags.some(tag => targetTags.has(tag))
}

function applyAura(source: SimUnit, target: SimUnit, aura: SupportAura, actions: BattleAction[]): void {
  if (aura.type === 'shield') {
    const shieldCap = Math.max(0, Math.floor(aura.value))
    if (shieldCap <= 0 || target.shield >= shieldCap) return

    const granted = shieldCap - target.shield
    target.maxShield = Math.max(target.maxShield, shieldCap)
    target.shield = shieldCap
    actions.push({ unitId: source.id, type: 'shield_apply', targetId: target.id, damage: granted })
    return
  }

  if (aura.type === 'shield_repair') {
    const repair = Math.max(0, Math.floor(aura.value))
    if (repair <= 0 || target.maxShield <= 0 || target.shield >= target.maxShield) return

    const granted = Math.min(repair, target.maxShield - target.shield)
    target.shield += granted
    actions.push({ unitId: source.id, type: 'shield_apply', targetId: target.id, damage: granted })
    return
  }

  if (aura.type === 'regen') {
    applyStatus(target, {
      type: 'regen',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      value: aura.value,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'reveal') {
    applyStatus(target, {
      type: 'revealed',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'cleanse') {
    cleanseStatuses(target, HARMFUL_STATUS_TYPES, actions)
    return
  }

  if (aura.type === 'status_immunity') {
    applyStatus(target, {
      type: 'status_immunity',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'haste') {
    applyStatus(target, {
      type: 'haste',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      value: aura.value,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'range_boost') {
    applyStatus(target, {
      type: 'range_boost',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      value: aura.value,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'attack_boost') {
    applyStatus(target, {
      type: 'attack_boost',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      value: aura.value,
      sourceUnitId: source.id
    }, actions)
    return
  }

  if (aura.type === 'damage_reduction') {
    applyStatus(target, {
      type: 'damage_reduction',
      duration: aura.duration ?? (aura.interval ?? DEFAULT_AURA_INTERVAL) + 1,
      value: aura.value,
      sourceUnitId: source.id
    }, actions)
  }
}

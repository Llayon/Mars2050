import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleAction, SimUnit, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import type { ReplayTeam, ReplayUnit } from './battle-replay-canvas-types'

type SpawnText = (text: string, x: number, y: number, color: string) => void
type SpawnProjectile = (x1: number, y1: number, x2: number, y2: number, color: string) => void

export function createReplayUnit(unit: SimUnit | UnitRow, team: ReplayTeam, isSimUnit: boolean): ReplayUnit | null {
  const id = unit.id
  if (!id) return null
  const type = isSimUnit ? (unit as SimUnit).type : (unit as UnitRow).unit_type
  const config = UNIT_TYPES[type as UnitTypeKey]?.baseStats
  const sim = isSimUnit ? unit as SimUnit : null
  const row = isSimUnit ? null : unit as UnitRow
  const x = sim ? sim.x : Number(row?.grid_x ?? 0)
  const y = sim ? sim.y : Number(row?.grid_y ?? 0)
  const maxHp = sim ? sim.maxHp : config?.hp ?? row?.hp_current ?? 1
  return {
    id,
    type,
    team,
    hp: sim ? sim.hp : row?.hp_current ?? maxHp,
    maxHp,
    size: sim?.size ?? config?.size ?? 'M',
    sX: x,
    sY: y,
    tX: x,
    tY: y,
    isDead: sim?.isDead ?? false,
    isFlying: sim?.isFlying ?? config?.isFlying ?? false,
    mobilityMode: sim?.mobilityMode,
    emp: false,
    stealth: sim?.movementStealthActive ?? false,
    flash: 0,
  }
}

export function createSpawnedUnit(action: BattleAction): ReplayUnit {
  const type = action.spawnType ?? 'marine'
  const config = UNIT_TYPES[type as UnitTypeKey]?.baseStats
  const x = action.toX ?? FIELD_WIDTH / 2
  const y = action.toY ?? FIELD_HEIGHT / 2
  const maxHp = action.spawnMaxHp ?? config?.hp ?? 1
  return {
    id: action.targetId ?? `${action.unitId}:spawn`,
    type,
    team: action.spawnTeam === 'defender' ? 'defender' : 'attacker',
    hp: maxHp,
    maxHp,
    size: config?.size ?? 'M',
    sX: x,
    sY: y,
    tX: x,
    tY: y,
    isDead: false,
    isFlying: config?.isFlying ?? false,
    emp: false,
    stealth: false,
    flash: 1,
  }
}

export function handleStatusAction(
  action: BattleAction,
  source: ReplayUnit | undefined,
  target: ReplayUnit | undefined,
  spawnText: SpawnText,
  spawnProjectile: SpawnProjectile
) {
  const subject = target ?? source
  if (isShieldLikeAction(action) && subject) {
    const label = shieldLabel(action)
    spawnText(action.damage !== undefined ? `${label} ${action.damage}` : label, subject.tX, subject.tY, '#60a5fa')
    return
  }
  if (action.type === 'status_apply' && subject) {
    subject.emp = action.statusType === 'emp' ? true : subject.emp
    spawnText(formatStatus(action.statusType), subject.tX, subject.tY, '#38bdf8')
    return
  }
  if (action.type === 'status_expire' && subject) {
    if (action.statusType === 'emp') subject.emp = false
    return
  }
  if (action.type === 'control_convert' && target && source) target.team = source.team
  if ((action.type === 'control_link' || action.type === 'control_progress') && source && target) {
    spawnProjectile(source.tX, source.tY, target.tX, target.tY, '#a78bfa')
  }
  if (action.type === 'stealth_change' && source) source.stealth = action.modeState === 'movement_active'
  if ((action.type === 'mode_change' || action.type === 'transform_mode') && source) source.mobilityMode = action.modeState
  const label = primitiveLabel(action)
  if (label && (source || target)) {
    const unit = source ?? target!
    spawnText(label, unit.tX, unit.tY, primitiveColor(action))
  }
}

export function applyHpDelta(unit: ReplayUnit, delta: number) {
  unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp + delta))
  if (unit.hp <= 0) unit.isDead = true
}

export function updateAged<T extends { age: number }>(items: T[], dt: number, maxAge: number) {
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].age += dt
    if (items[i].age >= maxAge) items.splice(i, 1)
  }
}

export function hazardColor(statusType?: string): string {
  if (statusType === 'smoke') return 'rgba(148,163,184,ALPHA)'
  if (statusType === 'barrier_dome') return 'rgba(34,211,238,ALPHA)'
  if (statusType === 'acid') return 'rgba(132,204,22,ALPHA)'
  return 'rgba(249,115,22,ALPHA)'
}

export function hazardLabel(statusType?: string): string {
  if (statusType === 'barrier_dome') return 'БАРЬЕР'
  if (statusType === 'smoke') return 'ДЫМ'
  if (statusType === 'acid') return 'КИСЛОТА'
  return 'ОГОНЬ'
}

function isShieldLikeAction(action: BattleAction): boolean {
  return action.type === 'shield_damage' || action.type === 'shield_break' || action.type === 'unit_blocked_damage' || action.type === 'barrier_absorb'
}

function shieldLabel(action: BattleAction): string {
  if (action.type === 'shield_break') return 'ЩИТ СЛОМАН'
  if (action.type === 'barrier_absorb') return 'БАРЬЕР'
  if (action.type === 'unit_blocked_damage') return 'БЛОК'
  return 'ЩИТ'
}

function primitiveLabel(action: BattleAction): string | null {
  switch (action.type) {
    case 'projectile_intercept': return 'ПЕРЕХВАТ'
    case 'control_break': return 'СВЯЗЬ'
    case 'control_convert': return 'КОНТРОЛЬ'
    case 'stealth_change': return action.modeState === 'movement_active' ? 'СКРЫТ' : 'ОБНАРУЖЕН'
    case 'periodic_ability': return action.statusType === 'spawn' ? 'ВОЛНА' : 'ЗАЛП'
    case 'trigger_effect': return 'ТРИГГЕР'
    case 'field_effect': return action.statusType === 'cleanse_field' ? 'ПОЛЕ ОЧИСТКИ' : 'ПОЛЕ'
    case 'hazard_cleanse': return 'ОЧИСТКА'
    case 'barrier_spawn': return 'БАРЬЕР'
    case 'barrier_break': return 'БАРЬЕР СЛОМАН'
    case 'barrier_expire': return 'БАРЬЕР ИСЧЕЗ'
    case 'adjacency_bonus': return 'СТРОЙ'
    case 'stance_change': return action.stanceMode === 'deployed' ? 'РАЗВЕРНУТ' : 'МОБИЛЕН'
    case 'mode_change': return action.modeState === 'air' ? 'ВЗЛЕТ' : 'ПОСАДКА'
    case 'attack_charge': return 'ЗАРЯД'
    case 'attack_charge_release': return 'РАЗРЯД'
    case 'reassembly_start': return 'СБОРКА'
    case 'reassembly_complete': return 'ВОССТАНОВЛЕН'
    case 'burrow_regen': return 'РЕГЕН'
    case 'emerge_strike': return 'УДАР'
    case 'conditional_attack_mode': return 'РЕЖИМ'
    case 'sweep_hit': return 'СВИП'
    case 'stat_growth': return 'РОСТ'
    default: return null
  }
}

function primitiveColor(action: BattleAction): string {
  if (action.type.startsWith('control')) return '#a78bfa'
  if (action.type.startsWith('barrier')) return '#22d3ee'
  if (action.type === 'stealth_change') return '#a3e635'
  if (action.type === 'hazard_cleanse' || action.type === 'field_effect') return '#38bdf8'
  return '#facc15'
}

function formatStatus(statusType?: string): string {
  return (statusType ?? 'status').replace(/_/g, ' ').toUpperCase()
}

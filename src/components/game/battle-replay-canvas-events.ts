import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleAction, SimUnit, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'
import { getReplayActionColor, getReplayActionLabel } from './battle-replay-labels'
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
    deathAgeMs: sim?.isDead ? 0 : undefined,
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
    deathAgeMs: undefined,
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
  if (action.type === 'status_apply' && subject) {
    subject.emp = action.statusType === 'emp' ? true : subject.emp
    const label = getReplayActionLabel(action)
    if (label) spawnText(label, subject.tX, subject.tY, getReplayActionColor(action))
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
  const label = getReplayActionLabel(action)
  if (label && (source || target)) {
    const unit = source ?? target!
    spawnText(label, unit.tX, unit.tY, getReplayActionColor(action))
  }
}

export function applyHpDelta(unit: ReplayUnit, delta: number) {
  unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp + delta))
  if (unit.hp <= 0) {
    unit.isDead = true
    unit.deathAgeMs ??= 0
  }
}

export function updateAged<T extends { age: number }>(items: T[], dt: number, maxAge: number) {
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].age += dt
    if (items[i].age >= maxAge) items.splice(i, 1)
  }
}

export function updateReplayUnitAges(units: ReplayUnit[], dt: number) {
  units.forEach(unit => {
    unit.flash = Math.max(0, unit.flash - dt / 220)
    if (unit.isDead) unit.deathAgeMs = (unit.deathAgeMs ?? 0) + dt
  })
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

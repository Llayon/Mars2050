import type { BattleAction, BattleActionType } from '@/domains/combat/combat.types'

export const REPLAY_ACTION_LABEL_EXEMPTIONS = [
  'move', 'knockback', 'attack', 'heal', 'die', 'spawn', 'hazard_spawn',
  'damage', 'damage_share', 'lifesteal', 'status_expire', 'status_tick',
  'control_link', 'control_progress', 'projectile_launch',
] as const satisfies readonly BattleActionType[]

export function getReplayActionLabel(action: BattleAction): string | null {
  switch (action.type) {
    case 'shield_damage': return action.damage !== undefined ? `ЩИТ ${action.damage}` : 'ЩИТ'
    case 'shield_break': return 'ЩИТ СЛОМАН'
    case 'shield_hit_block': return 'ЩИТ БЛОК'
    case 'shield_apply': return 'ЩИТ'
    case 'heal_blocked': return 'ЛЕЧЕНИЕ БЛОК'
    case 'unit_blocked_damage': return action.damage !== undefined ? `БЛОК ${action.damage}` : 'БЛОК'
    case 'barrier_absorb': return action.damage !== undefined ? `БАРЬЕР ${action.damage}` : 'БАРЬЕР'
    case 'status_apply': return formatStatus(action.statusType)
    case 'status_cleanse': return 'СТАТУС СНЯТ'
    case 'status_immune': return 'ИММУНИТЕТ'
    case 'target_mark': return 'МЕТКА ЦЕЛИ'
    case 'target_mark_expire': return 'МЕТКА СНЯТА'
    case 'spawn_blocked': return 'ЛИМИТ СПАВНА'
    case 'stance_change': return action.stanceMode === 'deployed' ? 'РАЗВЕРНУТ' : 'МОБИЛЕН'
    case 'burrow_change': return action.modeState === 'burrowed' ? 'ПОД ЗЕМЛЮ' : 'НА ПОВЕРХНОСТЬ'
    case 'mode_change': return action.modeState === 'air' ? 'ВЗЛЕТ' : 'ПОСАДКА'
    case 'projectile_intercept': return 'ПЕРЕХВАТ'
    case 'attack_windup': return 'ПОДГОТОВКА АТАКИ'
    case 'projectile_impact': return 'ПОПАДАНИЕ'
    case 'projectile_miss': return 'ПРОМАХ'
    case 'attack_cancel': return 'АТАКА ОТМЕНЕНА'
    case 'stealth_change': return action.modeState === 'movement_active' ? 'СКРЫТ' : 'ОБНАРУЖЕН'
    case 'cone_attack': return 'КОНУС ОГНЯ'
    case 'beam_tick': return 'ЛУЧ'
    case 'barrage_marker': return 'МЕТКА ЗАЛПА'
    case 'barrage_impact': return 'УДАР ЗАЛПА'
    case 'chain_jump': return 'ЦЕПЬ'
    case 'split_fire': return 'РАЗДЕЛ ОГНЯ'
    case 'side_weapon_attack': return 'БОКОВОЕ ОРУЖИЕ'
    case 'ramp_charge': return 'РАЗГОН'
    case 'charge_damage': return 'ТАРАН'
    case 'percent_hp_damage': return 'ДЕЗИНТЕГРАЦИЯ'
    case 'on_kill': return 'ЗА УБИЙСТВО'
    case 'periodic_ability': return action.statusType === 'spawn' ? 'ВОЛНА' : 'ЗАЛП'
    case 'trigger_effect': return triggerLabel(action.statusType)
    case 'control_break': return 'КОНТРОЛЬ СОРВАН'
    case 'control_convert': return 'КОНТРОЛЬ'
    case 'transform_mode': return 'ТРАНСФОРМ'
    case 'field_effect': return fieldLabel(action.statusType)
    case 'hazard_cleanse': return 'ОЧИСТКА'
    case 'adjacency_bonus': return 'СТРОЙ'
    case 'barrier_spawn': return 'БАРЬЕР'
    case 'barrier_break': return 'БАРЬЕР СЛОМАН'
    case 'barrier_expire': return 'БАРЬЕР ИСЧЕЗ'
    case 'stat_growth': return 'РОСТ'
    case 'attack_charge': return 'ЗАРЯД'
    case 'attack_charge_release': return 'РАЗРЯД'
    case 'reassembly_start': return 'СБОРКА'
    case 'reassembly_complete': return 'ВОССТАНОВЛЕН'
    case 'burrow_regen': return 'РЕГЕН'
    case 'emerge_strike': return 'УДАР'
    case 'conditional_attack_mode': return 'РЕЖИМ ОГНЯ'
    case 'sweep_hit': return 'СЕКТОРНЫЙ УДАР'
    case 'self_destruct': return 'ПОДРЫВ'
    default: return null
  }
}

export function getReplayActionColor(action: BattleAction): string {
  if (action.type.startsWith('control')) return '#a78bfa'
  if (action.type.startsWith('barrier') || action.type.includes('shield')) return '#22d3ee'
  if (action.type === 'stealth_change') return '#a3e635'
  if (action.type === 'hazard_cleanse' || action.type === 'field_effect' || action.type.startsWith('status')) return '#38bdf8'
  if (action.type === 'target_mark' || action.type === 'target_mark_expire') return '#fb7185'
  return '#facc15'
}

export function hasReplayActionLabel(type: BattleActionType): boolean {
  return getReplayActionLabel(sampleAction(type)) !== null
}

function sampleAction(type: BattleActionType): BattleAction {
  return { unitId: 'source', targetId: 'target', type, damage: 10, statusType: 'sample', modeState: 'air', stanceMode: 'deployed' }
}

function triggerLabel(statusType?: string): string {
  if (statusType?.includes('death')) return 'ПОСМЕРТНО'
  if (statusType?.includes('emergency')) return 'АВАРИЙНЫЙ ТРИГГЕР'
  return 'ТРИГГЕР'
}

function fieldLabel(statusType?: string): string {
  if (statusType === 'cleanse_field') return 'ПОЛЕ ОЧИСТКИ'
  if (statusType === 'barrier_dome') return 'БАРЬЕРНОЕ ПОЛЕ'
  if (statusType === 'smoke') return 'ДЫМОВОЕ ПОЛЕ'
  return 'ПОЛЕ'
}

function formatStatus(statusType?: string): string {
  return (statusType ?? 'status').replace(/_/g, ' ').toUpperCase()
}

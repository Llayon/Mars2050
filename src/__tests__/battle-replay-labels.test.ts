import { describe, expect, it } from 'vitest'
import { BATTLE_ACTION_TYPES, type BattleAction, type BattleActionType } from '@/domains/combat/combat.types'
import { getReplayActionColor, getReplayActionLabel, hasReplayActionLabel, REPLAY_ACTION_LABEL_EXEMPTIONS } from '@/components/game/battle-replay-labels'

const EXEMPT_ACTION_TYPES = new Set<BattleActionType>(REPLAY_ACTION_LABEL_EXEMPTIONS)

function action(type: BattleActionType, overrides: Partial<BattleAction> = {}): BattleAction {
  return { unitId: 'source', targetId: 'target', type, damage: 10, statusType: 'sample', modeState: 'air', stanceMode: 'deployed', ...overrides }
}

describe('battle replay labels', () => {
  it('keeps every battle action type either labeled or explicitly visual-only', () => {
    BATTLE_ACTION_TYPES.forEach(type => {
      const covered = hasReplayActionLabel(type) || EXEMPT_ACTION_TYPES.has(type)
      expect(covered, `${type} needs a replay label or visual-only exemption`).toBe(true)
    })
  })

  it('keeps label colors explicit for labeled action types', () => {
    BATTLE_ACTION_TYPES.filter(type => !EXEMPT_ACTION_TYPES.has(type)).forEach(type => {
      expect(getReplayActionColor(action(type)), `${type} color`).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('uses specific labels for high-signal primitive actions', () => {
    expect(getReplayActionLabel(action('trigger_effect', { statusType: 'on-death-spawn' }))).toBe('ПОСМЕРТНО')
    expect(getReplayActionLabel(action('trigger_effect', { statusType: 'emergency_armor' }))).toBe('АВАРИЙНЫЙ ТРИГГЕР')
    expect(getReplayActionLabel(action('field_effect', { statusType: 'cleanse_field' }))).toBe('ПОЛЕ ОЧИСТКИ')
    expect(getReplayActionLabel(action('field_effect', { statusType: 'barrier_dome' }))).toBe('БАРЬЕРНОЕ ПОЛЕ')
    expect(getReplayActionLabel(action('control_break'))).toBe('КОНТРОЛЬ СОРВАН')
    expect(getReplayActionLabel(action('conditional_attack_mode'))).toBe('РЕЖИМ ОГНЯ')
    expect(getReplayActionLabel(action('sweep_hit'))).toBe('СЕКТОРНЫЙ УДАР')
  })

  it('covers formerly easy-to-miss replay action labels', () => {
    expect(getReplayActionLabel(action('spawn_blocked'))).toBe('ЛИМИТ СПАВНА')
    expect(getReplayActionLabel(action('target_mark'))).toBe('МЕТКА ЦЕЛИ')
    expect(getReplayActionLabel(action('status_cleanse'))).toBe('СТАТУС СНЯТ')
    expect(getReplayActionLabel(action('status_immune'))).toBe('ИММУНИТЕТ')
    expect(getReplayActionLabel(action('burrow_change', { modeState: 'burrowed' }))).toBe('ПОД ЗЕМЛЮ')
    expect(getReplayActionLabel(action('barrage_marker'))).toBe('МЕТКА ЗАЛПА')
    expect(getReplayActionLabel(action('barrage_impact'))).toBe('УДАР ЗАЛПА')
    expect(getReplayActionLabel(action('chain_jump'))).toBe('ЦЕПЬ')
    expect(getReplayActionLabel(action('split_fire'))).toBe('РАЗДЕЛ ОГНЯ')
    expect(getReplayActionLabel(action('side_weapon_attack'))).toBe('БОКОВОЕ ОРУЖИЕ')
    expect(getReplayActionLabel(action('percent_hp_damage'))).toBe('ДЕЗИНТЕГРАЦИЯ')
    expect(getReplayActionLabel(action('on_kill'))).toBe('ЗА УБИЙСТВО')
  })
})

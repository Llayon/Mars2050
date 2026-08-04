import type { BattleAction } from '@/domains/combat/combat.types'
import type { SpriteState } from './battle-replay-units'

type SpawnText = (text: string, x: number, y: number, color: number) => void
type SpawnProjectile = (x1: number, y1: number, x2: number, y2: number, color: number) => void

export function handlePrimitiveReplayEvent(
  action: BattleAction,
  source: SpriteState,
  sprites: Record<string, SpriteState>,
  spawnTxt: SpawnText,
  spawnProj: SpawnProjectile
): boolean {
  if (action.type === 'hazard_cleanse') {
    spawnTxt('ОЧИСТКА', source.c.x, source.c.y, 0x7dd3fc)
    return true
  }
  if (action.type === 'periodic_ability') {
    spawnTxt(action.statusType === 'spawn' ? 'ВОЛНА' : 'ЗАЛП', source.c.x, source.c.y, 0xf97316)
    return true
  }
  if (action.type === 'trigger_effect') {
    spawnTxt(action.statusType?.includes('death') ? 'ПОСМЕРТНО' : 'ТРИГГЕР', source.c.x, source.c.y, 0xfacc15)
    return true
  }
  if (action.type === 'control_link' || action.type === 'control_progress') {
    const target = sprites[action.targetId!]
    if (target) spawnProj(source.c.x, source.c.y, target.c.x, target.c.y, 0xa78bfa)
    return true
  }
  if (action.type === 'control_break') {
    spawnTxt('СВЯЗЬ РАЗОРВАНА', source.c.x, source.c.y, 0xc084fc)
    return true
  }
  if (action.type === 'control_convert') {
    const target = sprites[action.targetId!]
    if (target) {
      target.team = source.team
      spawnTxt('КОНТРОЛЬ', target.c.x, target.c.y, 0xa78bfa)
    }
    return true
  }
  if (action.type === 'projectile_intercept') {
    if (action.fromX !== undefined && action.fromY !== undefined && action.toX !== undefined && action.toY !== undefined) {
      spawnProj(action.fromX, action.fromY, action.toX, action.toY, 0x22d3ee)
    }
    spawnTxt('ПЕРЕХВАТ', source.c.x, source.c.y, 0x22d3ee)
    return true
  }
  if (action.type === 'attack_windup') {
    spawnTxt('ЗАРЯДКА', source.c.x, source.c.y, 0xfbbf24)
    return true
  }
  if (action.type === 'attack_cancel') {
    spawnTxt('ОТМЕНА', source.c.x, source.c.y, 0x94a3b8)
    return true
  }
  if (action.type === 'projectile_launch') {
    const target = action.targetId ? sprites[action.targetId] : undefined
    if (target) spawnProj(source.c.x, source.c.y, target.c.x, target.c.y, 0xfb923c)
    return true
  }
  if (action.type === 'projectile_impact') {
    spawnTxt('УДАР', source.c.x, source.c.y, 0xf97316)
    return true
  }
  if (action.type === 'projectile_miss') {
    spawnTxt('ПРОМАХ', source.c.x, source.c.y, 0x94a3b8)
    return true
  }
  if (action.type === 'stealth_change') {
    spawnTxt(action.modeState === 'movement_active' ? 'СКРЫТ' : 'ОБНАРУЖЕН', source.c.x, source.c.y, action.modeState === 'movement_active' ? 0xa3e635 : 0xfacc15)
    return true
  }
  if (action.type === 'transform_mode') {
    spawnTxt('ТРАНСФОРМ', source.c.x, source.c.y, 0x38bdf8)
    return true
  }
  if (action.type === 'field_effect') {
    spawnTxt(action.statusType === 'cleanse_field' ? 'ПОЛЕ ОЧИСТКИ' : 'ПОЛЕ', source.c.x, source.c.y, 0x38bdf8)
    return true
  }
  if (action.type === 'adjacency_bonus') {
    spawnTxt('СТРОЙ', source.c.x, source.c.y, 0x86efac)
    return true
  }
  if (action.type === 'barrier_spawn' || action.type === 'barrier_break' || action.type === 'barrier_expire') {
    const label = action.type === 'barrier_spawn' ? 'БАРЬЕР' : action.type === 'barrier_break' ? 'БАРЬЕР СЛОМАН' : 'БАРЬЕР ИСЧЕЗ'
    spawnTxt(label, source.c.x, source.c.y, 0x22d3ee)
    return true
  }
  if (action.type === 'shield_hit_block') {
    spawnTxt('ЩИТ БЛОК', source.c.x, source.c.y, 0x60a5fa)
    return true
  }
  if (action.type === 'stat_growth') {
    spawnTxt('РОСТ', source.c.x, source.c.y, 0x4ade80)
    return true
  }
  if (action.type === 'attack_charge' || action.type === 'attack_charge_release') {
    spawnTxt(action.type === 'attack_charge' ? 'ЗАРЯД' : 'РАЗРЯД', source.c.x, source.c.y, 0xfacc15)
    return true
  }
  if (action.type === 'reassembly_start' || action.type === 'reassembly_complete') {
    spawnTxt(action.type === 'reassembly_start' ? 'СБОРКА' : 'ВОССТАНОВЛЕН', source.c.x, source.c.y, 0x60a5fa)
    return true
  }
  if (action.type === 'burrow_regen' || action.type === 'emerge_strike') {
    spawnTxt(action.type === 'burrow_regen' ? 'РЕГЕН' : 'УДАР', source.c.x, source.c.y, 0xa3e635)
    return true
  }
  if (action.type === 'conditional_attack_mode' || action.type === 'sweep_hit') {
    const target = action.targetId ? sprites[action.targetId] : undefined
    if (target) spawnProj(source.c.x, source.c.y, target.c.x, target.c.y, 0xfb7185)
    spawnTxt(action.type === 'conditional_attack_mode' ? 'РЕЖИМ' : 'СВИП', source.c.x, source.c.y, 0xfb7185)
    return true
  }
  return false
}

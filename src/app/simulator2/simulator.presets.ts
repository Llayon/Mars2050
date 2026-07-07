import { getZergRushPreset } from '@/domains/combat/combat.presets'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

export const SIMULATOR_PRESET_OPTIONS = [
  { id: 'zerg_rush', name: 'Зерг Раш' },
  { id: 'ranged_duel', name: 'Дуэль стрелков' },
  { id: 'massive_clash', name: 'Стенка 100+' },
  { id: 'stealth_reveal', name: 'Стелс / Радар' },
  { id: 'projectile_barrier', name: 'Ракеты / Щит' },
  { id: 'summon_caps', name: 'Призывы / Лимиты' },
  { id: 'control_status', name: 'Контроль / EMP' },
  { id: 'transform_modes', name: 'Режимы движения' },
  { id: 'cleanse_status', name: 'Очищение статусов' },
] as const

export function getSimulatorPreset(presetName: string): { attackers: UnitRow[], defenders: UnitRow[] } | null {
  if (presetName === 'zerg_rush') {
    return getZergRushPreset()
  } else if (presetName === 'ranged_duel') {
    return {
      attackers: line('rd-a', 'attacker', 'marine', 8, 120, 820, 40, 0, 100),
      defenders: line('rd-d', 'defender', 'marine', 8, 120, 220, 40, 0, 100),
    }
  } else if (presetName === 'massive_clash') {
    return {
      attackers: line('mc-a', 'attacker', 'shock_trooper', 6, 180, 820, 60, 35, 250),
      defenders: line('mc-d', 'defender', 'alien_bug', 6, 180, 380, 60, -35, 150),
    }
  } else if (presetName === 'stealth_reveal') {
    return { attackers: [row('sr-a-ghost', 'attacker', 'stealth_operative', 240, 760, 100, ['stealth_cloak']), row('sr-a-sniper', 'attacker', 'sniper', 320, 820, 30)], defenders: [row('sr-d-radar', 'defender', 'radar_zepplin', 250, 520, 500), row('sr-d-bounty', 'defender', 'bounty_hunter', 330, 500, 120)] }
  } else if (presetName === 'projectile_barrier') {
    return { attackers: [row('pb-a-missile', 'attacker', 'missile_buggy', 190, 820, 100), row('pb-a-artillery', 'attacker', 'artillery_crawler', 360, 860, 250)], defenders: [row('pb-d-shield', 'defender', 'shield_emitter', 270, 470, 200), row('pb-d-marine', 'defender', 'marine', 270, 430, 35)] }
  } else if (presetName === 'summon_caps') {
    return { attackers: [row('sc-a-factory', 'attacker', 'mobile_factory', 220, 820, 900), row('sc-a-carrier', 'attacker', 'drone_carrier', 360, 820, 400), row('sc-a-holo', 'attacker', 'hologram_projector', 300, 760, 80)], defenders: [row('sc-d-railgun', 'defender', 'railgun_walker', 260, 360, 250), row('sc-d-gatling', 'defender', 'gatling_rover', 360, 380, 120)] }
  } else if (presetName === 'control_status') {
    return { attackers: [row('cs-a-hacker', 'attacker', 'hacker_rover', 240, 780, 120), row('cs-a-emp', 'attacker', 'emp_drone', 340, 780, 40)], defenders: [row('cs-d-behemoth', 'defender', 'behemoth_tank', 260, 420, 1200), row('cs-d-exosuit', 'defender', 'exosuit', 380, 430, 150)] }
  } else if (presetName === 'transform_modes') {
    return { attackers: [row('tm-a-jetpack', 'attacker', 'jetpack_trooper', 220, 840, 45), row('tm-a-artillery', 'attacker', 'artillery_crawler', 360, 880, 250)], defenders: [row('tm-d-turret', 'defender', 'turret', 260, 360, 200), row('tm-d-bugs', 'defender', 'alien_bug', 360, 380, 20)] }
  } else if (presetName === 'cleanse_status') {
    return { attackers: [row('cl-a-flame', 'attacker', 'flamethrower', 220, 760, 60), row('cl-a-spitter', 'attacker', 'alien_spitter', 340, 760, 40)], defenders: [row('cl-d-engineer', 'defender', 'engineer', 280, 470, 100), row('cl-d-exosuit', 'defender', 'exosuit', 280, 430, 150)] }
  }
  return null;
}

function line(prefix: string, team: 'attacker' | 'defender', type: UnitTypeKey, count: number, x: number, y: number, dx: number, dy: number, hp: number): UnitRow[] {
  return Array.from({ length: count }, (_, i) => row(`${prefix}-${i}`, team, type, x + (i % 3) * dx, y + Math.floor(i / 3) * dy, hp))
}

function row(id: string, team: 'attacker' | 'defender', unit_type: UnitTypeKey, x: number, y: number, hp: number, upgrade_path: string[] = []): UnitRow {
  return { id, colony_id: team, unit_type, hp_current: hp, tier: 1, upgrade_path, grid_x: String(x), grid_y: String(y) }
}

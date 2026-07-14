import { getZergRushPreset } from '@/domains/combat/combat.presets'
import type { UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

export const SIMULATOR_PRESET_OPTIONS = [
  { id: 'zerg_rush', name: 'Зерг Раш' },
  { id: 'ranged_duel', name: 'Дуэль стрелков' },
  { id: 'marine_crowd_qa', name: 'QA: толпа морпехов' },
  { id: 'tier1_visual_qa', name: 'QA: визуалы T1' },
  { id: 'massive_clash', name: 'Стенка 100+' },
  { id: 'stealth_reveal', name: 'Стелс / Радар' },
  { id: 'projectile_barrier', name: 'Ракеты / Щит' },
  { id: 'summon_caps', name: 'Призывы / Лимиты' },
  { id: 'control_status', name: 'Контроль / EMP' },
  { id: 'transform_modes', name: 'Режимы движения' },
  { id: 'cleanse_status', name: 'Очищение статусов' },
  { id: 'qa_primitive_events', name: 'QA: события примитивов' },
] as const

export function getSimulatorPreset(presetName: string): { attackers: UnitRow[], defenders: UnitRow[] } | null {
  if (presetName === 'zerg_rush') {
    return getZergRushPreset()
  } else if (presetName === 'ranged_duel') {
    return {
      attackers: line('rd-a', 'attacker', 'marine', 8, 120, 820, 40, 0, 100),
      defenders: line('rd-d', 'defender', 'marine', 8, 120, 220, 40, 0, 100),
    }
  } else if (presetName === 'marine_crowd_qa') {
    return {
      attackers: [
        row('mcq-a-left', 'attacker', 'marine', 130, 820, 100),
        row('mcq-a-right', 'attacker', 'marine', 350, 820, 100),
      ],
      defenders: [
        row('mcq-d-left', 'defender', 'marine', 130, 250, 100),
        row('mcq-d-right', 'defender', 'marine', 350, 250, 100),
      ],
    }
  } else if (presetName === 'tier1_visual_qa') {
    return {
      attackers: [
        row('t1v-a-marine', 'attacker', 'marine', 120, 840, 100),
        row('t1v-a-shock', 'attacker', 'shock_trooper', 180, 820, 40),
        row('t1v-a-flame', 'attacker', 'flamethrower', 240, 840, 60),
        row('t1v-a-grenadier', 'attacker', 'grenadier', 300, 820, 40),
        row('t1v-a-heavy', 'attacker', 'heavy_gunner', 360, 840, 50),
        row('t1v-a-sapper', 'attacker', 'sapper', 420, 820, 30),
        row('t1v-a-officer', 'attacker', 'officer', 480, 840, 80),
      ],
      defenders: [
        row('t1v-d-bug-0', 'defender', 'alien_bug', 180, 360, 20),
        row('t1v-d-bug-1', 'defender', 'alien_bug', 240, 360, 20),
        row('t1v-d-bug-2', 'defender', 'alien_bug', 300, 360, 20),
        row('t1v-d-bug-3', 'defender', 'alien_bug', 360, 360, 20),
        row('t1v-d-bug-4', 'defender', 'alien_bug', 420, 360, 20),
      ],
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
  } else if (presetName === 'qa_primitive_events') {
    return {
      attackers: [
        row('qa-a-hacker', 'attacker', 'hacker_rover', 245, 650, 120, ['qa_conversion_beam']),
        row('qa-a-railgun', 'attacker', 'railgun_walker', 290, 720, 250),
        row('qa-a-holo', 'attacker', 'hologram_projector', 390, 700, 80, ['qa_fast_spawn_cap']),
        row('qa-a-smoke', 'attacker', 'alien_spitter', 315, 500, 40, ['qa_smoke_field']),
      ],
      defenders: [
        row('qa-d-control', 'defender', 'exosuit', 245, 570, 150),
        row('qa-d-cleanse', 'defender', 'engineer', 320, 470, 100, ['qa_cleanse_field']),
        row('qa-d-shield', 'defender', 'shield_emitter', 280, 455, 200, ['qa_barrier_dome']),
        row('qa-d-target', 'defender', 'behemoth_tank', 300, 430, 1200),
      ],
    }
  }
  return null;
}

function line(prefix: string, team: 'attacker' | 'defender', type: UnitTypeKey, count: number, x: number, y: number, dx: number, dy: number, hp: number): UnitRow[] {
  return Array.from({ length: count }, (_, i) => row(`${prefix}-${i}`, team, type, x + (i % 3) * dx, y + Math.floor(i / 3) * dy, hp))
}

function row(id: string, team: 'attacker' | 'defender', unit_type: UnitTypeKey, x: number, y: number, hp: number, upgrade_path: string[] = []): UnitRow {
  return { id, colony_id: team, unit_type, hp_current: hp, tier: 1, upgrade_path, grid_x: String(x), grid_y: String(y) }
}

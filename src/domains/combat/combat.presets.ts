import type { UnitRow, UnitTypeKey } from './combat.types'

export function getZergRushPreset(): { attackers: UnitRow[], defenders: UnitRow[] } {
  const attackers: UnitRow[] = [];
  // 3 Exosuits in front
  for (let i = 0; i < 3; i++) {
     attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'exosuit', hp_current: 120, tier: 1, upgrade_path: [], grid_x: String(250 + i * 50), grid_y: '700' });
  }
  // 10 Marines
  for (let i = 0; i < 10; i++) {
     attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'marine', hp_current: 40, tier: 1, upgrade_path: [], grid_x: String(200 + (i % 5) * 50), grid_y: String(750 + Math.floor(i / 5) * 40) });
  }
  // 2 Snipers
  attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'sniper', hp_current: 30, tier: 1, upgrade_path: [], grid_x: '280', grid_y: '850' });
  attackers.push({ id: crypto.randomUUID(), colony_id: 'attacker', unit_type: 'sniper', hp_current: 30, tier: 1, upgrade_path: [], grid_x: '320', grid_y: '850' });

  const defenders: UnitRow[] = [];
  // 50 Bugs!
  for (let i = 0; i < 50; i++) {
     const jitterX = Math.random() * 400 + 100;
     const jitterY = Math.random() * 200 + 100;
     defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_bug', hp_current: 50, tier: 1, upgrade_path: [], grid_x: String(jitterX), grid_y: String(jitterY) });
  }
  // 3 Spitters
  defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '200', grid_y: '50' });
  defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '300', grid_y: '50' });
  defenders.push({ id: crypto.randomUUID(), colony_id: 'defender', unit_type: 'alien_spitter', hp_current: 40, tier: 1, upgrade_path: [], grid_x: '400', grid_y: '50' });

  return { attackers, defenders };
}

export const UNIT_CATEGORIES = [
  {
    name: 'Тир 1 (Пехота)',
    keys: ['marine', 'shock_trooper', 'flamethrower', 'scout_drone', 'medic', 'sniper', 'scavenger_buggy', 'grenadier', 'heavy_gunner', 'sapper', 'officer', 'jetpack_trooper'] as UnitTypeKey[]
  },
  {
    name: 'Тир 2 (Средняя техника)',
    keys: ['exosuit', 'gatling_rover', 'plasma_tank', 'missile_buggy', 'gunship', 'engineer', 'emp_drone', 'minelayer_rover'] as UnitTypeKey[]
  },
  {
    name: 'Тир 3 (Тяжелая техника)',
    keys: ['siege_tank', 'railgun_walker', 'drone_carrier', 'cryo_tank', 'shield_emitter', 'interceptor', 'hacker_rover', 'artillery_crawler'] as UnitTypeKey[]
  },
  {
    name: 'Тир 4 (Сверхтяжелая)',
    keys: ['titan_mech', 'behemoth_tank', 'ion_crawler', 'goliath_gunship', 'mobile_factory', 'sonic_devastator', 'radar_zepplin'] as UnitTypeKey[]
  },
  {
    name: 'Тир 5 (Элита)',
    keys: ['stealth_operative', 'hologram_projector', 'gravity_manipulator', 'nanite_generator', 'bounty_hunter'] as UnitTypeKey[]
  },
  {
    name: 'Чужие (Жуки)',
    keys: ['alien_bug', 'alien_spitter', 'alien_worm'] as UnitTypeKey[]
  },
  {
    name: 'Постройки',
    keys: ['wall', 'turret', 'aa_turret'] as UnitTypeKey[]
  }
]

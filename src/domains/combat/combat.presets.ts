import type { UnitRow, UnitTypeKey } from './combat.types'

export function getZergRushPreset(): { attackers: UnitRow[], defenders: UnitRow[] } {
  const attackers: UnitRow[] = [];
  // 3 Exosuits in front
  for (let i = 0; i < 3; i++) {
     attackers.push(makePresetUnit(`zerg-a-exo-${i}`, 'attacker', 'exosuit', 250 + i * 50, 700, 120));
  }
  // 10 Marines
  for (let i = 0; i < 10; i++) {
     attackers.push(makePresetUnit(`zerg-a-marine-${i}`, 'attacker', 'marine', 200 + (i % 5) * 50, 750 + Math.floor(i / 5) * 40, 40));
  }
  // 2 Snipers
  attackers.push(makePresetUnit('zerg-a-sniper-0', 'attacker', 'sniper', 280, 850, 30));
  attackers.push(makePresetUnit('zerg-a-sniper-1', 'attacker', 'sniper', 320, 850, 30));

  const defenders: UnitRow[] = [];
  // 50 Bugs!
  for (let i = 0; i < 50; i++) {
     const jitterX = 100 + ((i * 73) % 400);
     const jitterY = 100 + ((i * 41) % 200);
     defenders.push(makePresetUnit(`zerg-d-bug-${i}`, 'defender', 'alien_bug', jitterX, jitterY, 50));
  }
  // 3 Spitters
  defenders.push(makePresetUnit('zerg-d-spitter-0', 'defender', 'alien_spitter', 200, 50, 40));
  defenders.push(makePresetUnit('zerg-d-spitter-1', 'defender', 'alien_spitter', 300, 50, 40));
  defenders.push(makePresetUnit('zerg-d-spitter-2', 'defender', 'alien_spitter', 400, 50, 40));

  return { attackers, defenders };
}

function makePresetUnit(id: string, colonyId: string, unitType: UnitTypeKey, x: number, y: number, hp: number): UnitRow {
  return { id, colony_id: colonyId, unit_type: unitType, hp_current: hp, tier: 1, upgrade_path: [], grid_x: String(x), grid_y: String(y) }
}

export const UNIT_CATEGORIES = [
  {
    name: 'Тир 1 (Пехота)',
    keys: ['marine', 'shock_trooper', 'flamethrower', 'scout_drone', 'medic', 'sniper', 'scavenger_buggy', 'grenadier', 'heavy_gunner', 'explosive_drone', 'light_walker', 'jetpack_trooper'] as UnitTypeKey[]
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

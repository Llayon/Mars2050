export interface UpgradeConfig {
  id: string
  name: string
  description: string
  cost: number
  allowedUnits: string[] // 'all' or specific unit keys
  modifiers: {
    hpMult?: number
    attackMult?: number
    speedMult?: number
    rangeAdd?: number // in tiles (1 tile = 40px)
    cooldownMult?: number
    addFlying?: boolean
    addAoE?: number // in tiles
    defenseAdd?: number
    grantShield?: number // Adds maxShield
    stealthWhileMoving?: boolean
    onDeathSpawn?: string
    periodicSpawn?: { unit: string, interval: number }
    disableEnemyTech?: boolean // EMP
    leaveAoePuddle?: boolean // Napalm
  }
}

export const UPGRADES: Record<string, UpgradeConfig> = {
  stimpacks: {
    id: 'stimpacks', name: 'Стимуляторы', description: 'Скорость атаки +50%, Здоровье -20%', cost: 100, allowedUnits: ['marine', 'shock_trooper', 'flamethrower', 'heavy_gunner'], modifiers: { cooldownMult: 0.5, hpMult: 0.8 }
  },
  hollow_point: {
    id: 'hollow_point', name: 'Экспансивные пули', description: 'Урон +50%', cost: 150, allowedUnits: ['marine', 'heavy_gunner', 'sniper', 'gatling_rover'], modifiers: { attackMult: 1.5 }
  },
  extended_barrel: {
    id: 'extended_barrel', name: 'Оптика', description: 'Дальность стрельбы +2', cost: 200, allowedUnits: ['marine', 'sniper', 'siege_tank', 'missile_buggy'], modifiers: { rangeAdd: 2 }
  },
  jump_pack: {
    id: 'jump_pack', name: 'Прыжковые ранцы', description: 'Дает возможность перелетать препятствия (Летающий) и Скорость +30%', cost: 300, allowedUnits: ['shock_trooper', 'sapper', 'exosuit'], modifiers: { addFlying: true, speedMult: 1.3 }
  },
  heavy_armor: {
    id: 'heavy_armor', name: 'Тяжелая броня', description: 'Броня +5, Здоровье +30%, Скорость -20%', cost: 250, allowedUnits: ['all'], modifiers: { defenseAdd: 5, hpMult: 1.3, speedMult: 0.8 }
  },
  incendiary_ammo: {
    id: 'incendiary_ammo', name: 'Зажигательные снаряды', description: 'Оставляет огненную лужу (Напалм)', cost: 300, allowedUnits: ['missile_buggy', 'gunship', 'railgun_walker', 'scavenger_buggy', 'flamethrower'], modifiers: { leaveAoePuddle: true, attackMult: 0.8 }
  },
  photon_coating: {
    id: 'photon_coating', name: 'Фотонное покрытие', description: 'Дает энергетический щит на 50% от максимального ХП', cost: 400, allowedUnits: ['all'], modifiers: { grantShield: 0.5 }
  },
  overclock: {
    id: 'overclock', name: 'Разгон ядра', description: 'Урон +100%, Скорость атаки +50%, Здоровье -50%', cost: 300, allowedUnits: ['plasma_tank', 'siege_tank', 'titan_mech', 'cryo_tank'], modifiers: { attackMult: 2.0, cooldownMult: 0.5, hpMult: 0.5 }
  },
  emp_rounds: {
    id: 'emp_rounds', name: 'ЭМИ-снаряды', description: 'Отключает технологии цели на 3 секунды', cost: 300, allowedUnits: ['sniper', 'railgun_walker'], modifiers: { disableEnemyTech: true }
  },
  drone_carrier: {
    id: 'drone_carrier', name: 'Улей-модуль', description: 'Каждые 15 секунд выпускает 1 Развед-дрона', cost: 500, allowedUnits: ['carrier', 'titan_mech'], modifiers: { periodicSpawn: { unit: 'scout_drone', interval: 15 } }
  }
}

export interface GlobalUpgradeConfig {
  id: string
  name: string
  description: string
  cost: number
  type: 'orbital_strike' | 'mass_heal' | 'mass_shield' | 'global_emp'
  value: number
  target: 'allies' | 'enemies' | 'center'
}

export const GLOBAL_UPGRADES: Record<string, GlobalUpgradeConfig> = {
  orbital_strike: {
    id: 'orbital_strike', name: 'Орбитальный удар', description: 'На 10-й секунде (100-й тик) наносит 800 урона по площади в центре вражеской армии', cost: 1000, type: 'orbital_strike', value: 800, target: 'enemies'
  },
  mass_shield: {
    id: 'mass_shield', name: 'Поле дефлекторов', description: 'Дает всем союзникам щит (+300 единиц) в самом начале боя', cost: 800, type: 'mass_shield', value: 300, target: 'allies'
  },
  mass_heal: {
    id: 'mass_heal', name: 'Наниты-регенераторы', description: 'На 15-й секунде (150-й тик) лечит всех союзников на 500 единиц', cost: 600, type: 'mass_heal', value: 500, target: 'allies'
  },
  global_emp: {
    id: 'global_emp', name: 'Глобальный ЭМИ', description: 'На 5-й секунде накладывает ЭМИ на всех врагов (отключает их урон на 3 сек)', cost: 700, type: 'global_emp', value: 30, target: 'enemies'
  }
}

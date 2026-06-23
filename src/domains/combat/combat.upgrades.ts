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
    damageReductionWhileMoving?: number // Reduces damage taken while moving
    onDeathPuddle?: 'napalm' | 'acid' | 'emp' // Drops hazard on death
    multishot?: number // Number of shots per attack
    antiAirDamageMult?: number // Damage multiplier against flying targets
    grantAntiAir?: boolean // Allows targeting flying units
    grantShieldFlat?: number // Flat shield amount
    replicateOnKill?: boolean // Spawns a clone on kill
    resurrectOnce?: boolean
    stealthUntilAttack?: boolean
    executeThreshold?: number
    lifestealMult?: number
    groundDamageMult?: number
  }
}

export const UPGRADES: Record<string, UpgradeConfig> = {
  // Legacy / General
  stimpacks: { id: 'stimpacks', name: 'Стимуляторы', description: 'Скорость атаки +50%, Здоровье -20%', cost: 100, allowedUnits: ['marine', 'heavy_gunner'], modifiers: { cooldownMult: 0.5, hpMult: 0.8 } },
  hollow_point: { id: 'hollow_point', name: 'Экспансивные пули', description: 'Урон +50%', cost: 150, allowedUnits: ['marine', 'heavy_gunner', 'gatling_rover'], modifiers: { attackMult: 1.5 } },
  heavy_armor: { id: 'heavy_armor', name: 'Тяжелая броня', description: 'Броня +5, Здоровье +30%, Скорость -20%', cost: 250, allowedUnits: ['all'], modifiers: { defenseAdd: 5, hpMult: 1.3, speedMult: 0.8 } },
  photon_coating: { id: 'photon_coating', name: 'Фотонное покрытие', description: 'Дает энергетический щит на 50% от максимального ХП', cost: 400, allowedUnits: ['all'], modifiers: { grantShield: 0.5 } },

  // New Mechabellum-inspired Techs
  parasitic_infestation: {
    id: 'parasitic_infestation', name: 'Паразитическое заражение', description: 'Убив вражеского юнита, создает из его трупа нового Жука.', 
    cost: 450, allowedUnits: ['alien_bug'], modifiers: { replicateOnKill: true }
  },
  subterranean_blitz: { 
    id: 'subterranean_blitz', name: 'Подземный рывок', description: 'Юнит зарывается под землю во время движения, получая на 45% меньше урона и ускоряясь на 20%.', 
    cost: 350, allowedUnits: ['shock_trooper', 'alien_bug'], modifiers: { damageReductionWhileMoving: 0.45, speedMult: 1.2 } 
  },
  portable_shield: { 
    id: 'portable_shield', name: 'Портативный щит', description: 'Каждый боец получает персональный энергощит, впитывающий 150 урона.', 
    cost: 400, allowedUnits: ['marine'], modifiers: { grantShieldFlat: 150 } 
  },
  acidic_explosion: { 
    id: 'acidic_explosion', name: 'Кислотный взрыв', description: 'После смерти оставляет лужу кислоты, наносящую урон врагам.', 
    cost: 200, allowedUnits: ['shock_trooper', 'alien_bug', 'alien_spitter'], modifiers: { onDeathPuddle: 'acid' } 
  },
  range_enhancement: { 
    id: 'range_enhancement', name: 'Продвинутая оптика', description: 'Дальность стрельбы +3.', 
    cost: 300, allowedUnits: ['marine', 'sniper', 'siege_tank', 'missile_buggy'], modifiers: { rangeAdd: 3 } 
  },
  doubleshot: { 
    id: 'doubleshot', name: 'Двойной выстрел', description: 'Производит 2 выстрела подряд, урон каждого снижен на 15%.', 
    cost: 250, allowedUnits: ['sniper'], modifiers: { multishot: 2, attackMult: 0.85 } 
  },
  aerial_specialization: { 
    id: 'aerial_specialization', name: 'ПВО-Специализация', description: 'Урон по летающим целям +90%.', 
    cost: 250, allowedUnits: ['sniper', 'marine', 'aa_turret'], modifiers: { antiAirDamageMult: 1.9 } 
  },
  anti_aircraft_ammo: { 
    id: 'anti_aircraft_ammo', name: 'Зенитные боеприпасы', description: 'Позволяет атаковать летающие цели.', 
    cost: 300, allowedUnits: ['flamethrower', 'grenadier'], modifiers: { grantAntiAir: true } 
  },
  incendiary_ammo: {
    id: 'incendiary_ammo', name: 'Зажигательные снаряды', description: 'Оставляет огненную лужу (Напалм), но базовый урон снижен.', 
    cost: 300, allowedUnits: ['missile_buggy', 'gunship', 'railgun_walker', 'scavenger_buggy', 'flamethrower'], modifiers: { leaveAoePuddle: true, attackMult: 0.8 }
  },
  emp_rounds: {
    id: 'emp_rounds', name: 'ЭМИ-снаряды', description: 'Отключает технологии цели на 3 секунды', cost: 300, allowedUnits: ['sniper', 'railgun_walker', 'heavy_gunner'], modifiers: { disableEnemyTech: true }
  },
  overclock: {
    id: 'overclock', name: 'Разгон ядра', description: 'Урон +100%, Скорость атаки +50%, Здоровье -50%', cost: 300, allowedUnits: ['plasma_tank', 'siege_tank', 'titan_mech', 'cryo_tank'], modifiers: { attackMult: 2.0, cooldownMult: 0.5, hpMult: 0.5 }
  },
  drone_carrier: {
    id: 'drone_carrier', name: 'Улей-модуль', description: 'Каждые 15 секунд выпускает 1 Развед-дрона', cost: 500, allowedUnits: ['carrier', 'titan_mech'], modifiers: { periodicSpawn: { unit: 'scout_drone', interval: 15 } }
  },
  energy_absorption: {
    id: 'energy_absorption', name: 'Поглощение энергии', description: 'Вампиризм: лечит юнита на 50% от нанесенного урона.', cost: 200, allowedUnits: ['exosuit', 'plasma_tank', 'marine'], modifiers: { lifestealMult: 0.5 }
  },
  culling_rounds: {
    id: 'culling_rounds', name: 'Калибровочные снаряды', description: 'Мгновенно уничтожает цели с HP ниже 300. Снижает базовый урон на 20%.', cost: 200, allowedUnits: ['gatling_rover', 'heavy_gunner'], modifiers: { executeThreshold: 300, attackMult: 0.8 }
  },
  field_reassembly: {
    id: 'field_reassembly', name: 'Ремонтный модуль', description: 'При смерти воскрешается с 100% HP (один раз за бой).', cost: 300, allowedUnits: ['titan_mech', 'behemoth_tank'], modifiers: { resurrectOnce: true }
  },
  stealth_cloak: {
    id: 'stealth_cloak', name: 'Стелс-маскировка', description: 'Невидим и неуязвим до первой атаки.', cost: 150, allowedUnits: ['stealth_operative', 'sniper'], modifiers: { stealthUntilAttack: true }
  },
  ground_specialization: {
    id: 'ground_specialization', name: 'Удар с небес', description: '+150% урона по наземным целям.', cost: 200, allowedUnits: ['gunship', 'interceptor'], modifiers: { groundDamageMult: 2.5 }
  },
  clone_hive: {
    id: 'clone_hive', name: 'Био-клонирование', description: 'Убив врага, юнит создает свою копию (с 50% HP).', cost: 150, allowedUnits: ['alien_bug', 'alien_spitter'], modifiers: { replicateOnKill: true }
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

alter table public.units
  drop constraint if exists units_unit_type_check;

update public.units
set unit_type = case
  when unit_type = 'sapper' then 'explosive_drone'
  when unit_type = 'officer' then 'light_walker'
  else unit_type
end
where unit_type in ('sapper', 'officer');

alter table public.units
  add constraint units_unit_type_check check (unit_type in (
    'marine', 'exosuit', 'sniper', 'medic', 'rocketeer', 'engineer',
    'wall', 'turret', 'alien_worm', 'alien_spitter', 'alien_bug',
    'drone', 'aa_turret', 'shock_trooper', 'flamethrower',
    'scout_drone', 'scavenger_buggy', 'gatling_rover', 'plasma_tank',
    'missile_buggy', 'gunship', 'emp_drone', 'minelayer_rover',
    'siege_tank', 'railgun_walker', 'drone_carrier', 'cryo_tank',
    'shield_emitter', 'interceptor', 'hacker_rover',
    'artillery_crawler', 'titan_mech', 'behemoth_tank', 'ion_crawler',
    'goliath_gunship', 'mobile_factory', 'sonic_devastator',
    'radar_zepplin', 'stealth_operative', 'hologram_projector',
    'gravity_manipulator', 'nanite_generator', 'bounty_hunter',
    'grenadier', 'heavy_gunner', 'explosive_drone', 'light_walker',
    'sapper', 'officer', 'jetpack_trooper'
  ));

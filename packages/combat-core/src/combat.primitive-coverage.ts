export type PrimitiveCoverageStatus = 'implemented' | 'implemented-by-existing-primitive' | 'primitive-covered' | 'deferred'

export const MECHABELLUM_TECH_NAMES = [
  'Accumulator Shield', 'Acid Attack', 'Acidic Explosion', 'Aerial Mode', 'Aerial Specialization', 'Air Defense Mark',
  'Anti-Aerial', 'Anti-Air Barrage', 'Anti-Aircraft Ammunition', 'Armor Enhancement', 'Armor-Piercing Bullets',
  'Assault Mode', 'Barrier', 'Best Partner', 'Burrow Maintenance', 'Burst Mode', 'Chain', 'Chamber Compression',
  'Charged Shot', 'Combat Evolvement', 'Convergent Fire', 'Counter-Fire', 'Crawler Production', 'Culling Rounds',
  'Damage Sharing', 'Dark Companion', 'Degeneration Beam', 'Disintegration', 'Doubleshot', 'Electromagnetic Armor',
  'Electromagnetic Barrage', 'Electromagnetic Bomb', 'Electromagnetic Cloud', 'Electromagnetic Explosion',
  'Electromagnetic Interference', 'Electromagnetic Shot', 'Electromagnetic Twin', 'Elite Marksman', 'Emergency Armor',
  'Energy Absorption', 'Energy Diffraction', 'Energy Shield', 'Enhanced Control', 'Extended Range Ammo',
  'Fang Production', 'Field Entrenchment', 'Field Maintenance', 'Field Reassembly', 'Final Blitz', 'Fire Extinguisher',
  'Floating Artillery Array', 'Fork', 'Fortified Target Lock', 'Grenade Launcher', 'Grid Integration',
  'Ground Specialization', 'Ground Targeting', 'Gun-launched Missile', 'High Explosive Anti-tank Shells',
  'High-Explosive Ammo', 'Ignite', 'Impact Drill', 'Incendiary Bomb', 'Ionization', 'Jump Drive', 'Kinetic Charge',
  'Land Cruiser', 'Launcher Overload', 'Loose Formation', 'Maintenance Array', 'Mechanical Division',
  'Mechanical Rage', 'Missile Interceptor', 'Mobile Power Station', 'Mothership', 'Mountain Plating', 'Multi Control',
  'Napalm', 'Overlord Artillery', 'Phoenix Production', 'Photon Coating', 'Photon Emission', 'Photon Loop',
  'Portable Shield', 'Power Armor', 'Quantum Reassembly', 'Quick Reload', 'Range Enhancement', 'Reactive Armor',
  'Replicate', 'Rocket Punch', 'Sandstorm', 'Saturation Bombardment', 'Scanning Radar', 'Scorching Charge',
  'Scorching Fire', 'Secondary Armament', 'Shockwave', 'Shooting Squad', 'Siege Mode', 'Sledgehammer Production',
  'Smoke Bomb', 'Solid Shot', 'Spider Mine', 'Stealth Cloak', 'Steel Ball Production', 'Sticky Oil Bomb', 'Strike',
  'Subterranean Blitz', 'Suppression Shots', 'Swarm Missiles', 'Vertical Sweep', 'Whirlwind', 'Wreckage Detonation',
  'Wreckage Recycling',
] as const

export type MechabellumTechName = typeof MECHABELLUM_TECH_NAMES[number]

const primitiveCovered = new Set<MechabellumTechName>([
  'Barrier', 'Burrow Maintenance', 'Chamber Compression', 'Combat Evolvement', 'Crawler Production',
  'Elite Marksman', 'Fang Production', 'Field Reassembly', 'Grid Integration', 'Maintenance Array',
  'Mothership', 'Phoenix Production', 'Quantum Reassembly', 'Shooting Squad', 'Sledgehammer Production',
  'Steel Ball Production', 'Strike', 'Vertical Sweep', 'Whirlwind',
])

const existingPrimitive = new Set<MechabellumTechName>([
  'Best Partner', 'Burst Mode', 'Chain', 'Convergent Fire', 'Dark Companion', 'Doubleshot', 'Energy Diffraction',
  'Floating Artillery Array', 'Fork', 'Ground Targeting', 'Gun-launched Missile', 'High Explosive Anti-tank Shells',
  'High-Explosive Ammo', 'Impact Drill', 'Kinetic Charge', 'Launcher Overload', 'Mountain Plating',
  'Overlord Artillery', 'Power Armor', 'Quick Reload', 'Saturation Bombardment', 'Secondary Armament', 'Shockwave',
  'Solid Shot', 'Spider Mine',
])

export const MECHABELLUM_TECH_COVERAGE: Record<MechabellumTechName, PrimitiveCoverageStatus> = Object.fromEntries(
  MECHABELLUM_TECH_NAMES.map(name => [
    name,
    primitiveCovered.has(name) ? 'primitive-covered' : existingPrimitive.has(name) ? 'implemented-by-existing-primitive' : 'implemented',
  ])
) as Record<MechabellumTechName, PrimitiveCoverageStatus>

import type { UnitRow, UnitTypeKey } from './combat.types'

export const UNIT_UPKEEP: Partial<Record<UnitTypeKey, Record<string, number>>> = {
  // Tier 1
  marine:           { food: 0.5 },
  shock_trooper:    { food: 0.8 },
  flamethrower:     { food: 0.5, energy: 0.5 },
  scout_drone:      { energy: 0.5 },
  medic:            { food: 0.5, energy: 0.2 },
  sniper:           { food: 0.6, energy: 0.2 },
  scavenger_buggy:  { energy: 1.0 },
  grenadier:        { food: 0.5, minerals: 0.5 },
  heavy_gunner:     { food: 0.8, minerals: 0.2 },
  sapper:           { food: 0.5, minerals: 0.8 },
  officer:          { food: 1.0, consumer_goods: 0.5 },
  jetpack_trooper:  { food: 0.5, energy: 1.0 },

  // Tier 2
  exosuit:          { food: 0.3, energy: 0.5 },
  gatling_rover:    { energy: 1.5, minerals: 0.2 },
  plasma_tank:      { energy: 2.0, minerals: 0.5 },
  missile_buggy:    { energy: 1.5, minerals: 0.8 },
  gunship:          { energy: 2.5, minerals: 0.5 },
  engineer:         { food: 0.3, energy: 1.0 },
  emp_drone:        { energy: 1.5 },
  minelayer_rover:  { energy: 1.0, minerals: 1.5 },

  // Tier 3
  siege_tank:       { energy: 4.0, minerals: 1.0 },
  railgun_walker:   { energy: 4.5, rare_metals: 0.2 },
  drone_carrier:    { energy: 5.0, minerals: 1.5 },
  cryo_tank:        { energy: 4.0, rare_metals: 0.3 },
  shield_emitter:   { energy: 6.0 },
  interceptor:      { energy: 3.5, rare_metals: 0.2 },
  hacker_rover:     { energy: 3.0, databanks: 0.5 },
  artillery_crawler:{ energy: 5.0, minerals: 2.0 },

  // Tier 4
  titan_mech:       { energy: 10.0, nanomaterials: 0.5 },
  behemoth_tank:    { energy: 8.0, minerals: 5.0, rare_metals: 1.0 },
  ion_crawler:      { energy: 12.0, rare_metals: 0.5 },
  goliath_gunship:  { energy: 9.0, rare_metals: 0.8 },
  mobile_factory:   { energy: 15.0, minerals: 8.0 },
  sonic_devastator: { energy: 10.0, rare_metals: 1.0 },
  radar_zepplin:    { energy: 6.0, databanks: 1.0 },
  stealth_operative:{ food: 2.0, consumer_goods: 2.0, nanomaterials: 0.2 },
  hologram_projector:{ energy: 8.0, databanks: 0.8 },
  gravity_manipulator:{ energy: 15.0, nanomaterials: 1.0 },
  nanite_generator: { energy: 12.0, nanomaterials: 2.0 },
  bounty_hunter:    { food: 3.0, consumer_goods: 2.0 },
}

/**
 * Calculates total resource upkeep per hour for a list of units.
 */
export function calculateArmyUpkeep(
  units: UnitRow[]
): Record<string, number> {
  const upkeep: Record<string, number> = {}
  for (const unit of units) {
    const cost = UNIT_UPKEEP[unit.unit_type as UnitTypeKey]
    if (!cost) continue
    for (const [res, amount] of Object.entries(cost)) {
      upkeep[res] = (upkeep[res] ?? 0) + amount
    }
  }
  return upkeep
}

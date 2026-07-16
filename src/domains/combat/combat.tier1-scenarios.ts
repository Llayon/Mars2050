import { UNIT_TYPES } from './combat.config'
import type { Team, UnitRow, UnitTypeKey } from './combat.types'

export interface CombatBalanceScenario {
  id: string
  name: string
  attackers: UnitRow[]
  defenders: UnitRow[]
}

export const TIER1_BALANCE_SCENARIOS: CombatBalanceScenario[] = [
  scenario('tier1_marine_baseline_duel', 'Tier 1: marine baseline duel',
    squads('t1-marine-a', 'attacker', 'marine', 3, 220, 820, 56),
    squads('t1-marine-d', 'defender', 'marine', 3, 220, 260, 56)),
  scenario('tier1_shock_screen_vs_snipers', 'Tier 1: shock screen versus precision fire',
    squads('t1-shock-a', 'attacker', 'shock_trooper', 3, 180, 900, 120),
    squads('t1-sniper-d', 'defender', 'sniper', 3, 180, 300, 120)),
  scenario('tier1_flamethrower_vs_shock_screen', 'Tier 1: flamethrower clears assault screen',
    squads('t1-flame-a', 'attacker', 'flamethrower', 3, 180, 900, 120),
    squads('t1-shock-flame-d', 'defender', 'shock_trooper', 3, 180, 300, 120)),
  scenario('tier1_flamethrower_vs_ranged_line', 'Tier 1: flamethrower exposed to range',
    squads('t1-flame-range-a', 'attacker', 'flamethrower', 3, 180, 900, 120),
    squads('t1-marine-range-d', 'defender', 'marine', 3, 180, 300, 120)),
  scenario('tier1_grenadier_vs_clump', 'Tier 1: grenadier versus clump',
    squads('t1-gren-a', 'attacker', 'grenadier', 3, 240, 900, 60),
    squads('t1-shock-clump-d', 'defender', 'shock_trooper', 3, 240, 300, 60)),
  scenario('tier1_grenadier_vs_spread', 'Tier 1: grenadier versus spread',
    squads('t1-gren-spread-a', 'attacker', 'grenadier', 3, 240, 900, 60),
    [
      row('t1-shock-spread-d-0', 'defender', 'shock_trooper', 60, 300),
      row('t1-shock-spread-d-1', 'defender', 'shock_trooper', 300, 300),
      row('t1-shock-spread-d-2', 'defender', 'shock_trooper', 540, 300),
    ]),
  scenario('tier1_sniper_priority_target', 'Tier 1: sniper priority target',
    [row('t1-sniper-a', 'attacker', 'sniper', 300, 900), ...squads('t1-sniper-screen-a', 'attacker', 'marine', 2, 200, 820, 200)],
    [row('t1-medic-d', 'defender', 'medic', 300, 380), ...squads('t1-medic-screen-d', 'defender', 'marine', 2, 200, 300, 200)]),
  scenario('tier1_scout_focus_fire', 'Tier 1: scout marks for precision line',
    [
      ...squads('t1-scout-marine-a', 'attacker', 'marine', 5, 90, 930, 120),
      row('t1-scout-a', 'attacker', 'scout_drone', 90, 1050),
    ],
    [
      ...squads('t1-scout-marine-d', 'defender', 'marine', 5, 90, 270, 120),
      row('t1-scout-marine-rear-d', 'defender', 'marine', 90, 150),
    ]),
  scenario('tier1_scout_countered_by_heavy', 'Tier 1: heavy gunner soft anti-air',
    squads('t1-scout-aa-a', 'attacker', 'scout_drone', 3, 180, 900, 120),
    squads('t1-heavy-aa-d', 'defender', 'heavy_gunner', 3, 180, 300, 120)),
  scenario('tier1_medic_sustain_check', 'Tier 1: medic sustain check',
    [row('t1-medic-a', 'attacker', 'medic', 300, 950), ...squads('t1-medic-line-a', 'attacker', 'marine', 5, 120, 820, 90)],
    squads('t1-medic-line-d', 'defender', 'marine', 6, 75, 300, 90)),
  scenario('tier1_officer_compact_aura', 'Tier 1: officer inside compact line',
    [row('t1-officer-a', 'attacker', 'officer', 300, 900), ...squads('t1-officer-line-a', 'attacker', 'marine', 5, 120, 820, 90)],
    squads('t1-officer-line-d', 'defender', 'marine', 6, 75, 300, 90)),
  scenario('tier1_officer_out_of_position', 'Tier 1: officer outside aura range',
    [row('t1-officer-far-a', 'attacker', 'officer', 300, 1170), ...squads('t1-officer-far-line-a', 'attacker', 'marine', 5, 120, 820, 90)],
    squads('t1-officer-far-line-d', 'defender', 'marine', 6, 75, 300, 90)),
  scenario('tier1_buggy_charge_flank', 'Tier 1: scavenger buggy charge flank',
    squads('t1-buggy-a', 'attacker', 'scavenger_buggy', 3, 180, 900, 120),
    squads('t1-buggy-sniper-d', 'defender', 'sniper', 3, 180, 300, 120)),
  scenario('tier1_sapper_point_blank_stop', 'Tier 1: sapper stops charge at point blank',
    squads('t1-sapper-close-a', 'attacker', 'sapper', 3, 180, 400, 120),
    squads('t1-buggy-close-d', 'defender', 'scavenger_buggy', 3, 180, 300, 120)),
  scenario('tier1_sapper_long_approach', 'Tier 1: sapper exposed on long approach',
    squads('t1-sapper-far-a', 'attacker', 'sapper', 3, 180, 900, 120),
    squads('t1-buggy-far-d', 'defender', 'scavenger_buggy', 3, 180, 300, 120)),
  scenario('tier1_heavy_gunner_sustained_line', 'Tier 1: protected heavy gunner line',
    [row('t1-heavy-a', 'attacker', 'heavy_gunner', 300, 900), ...squads('t1-heavy-screen-a', 'attacker', 'marine', 2, 220, 820, 160)],
    squads('t1-heavy-shock-d', 'defender', 'shock_trooper', 3, 180, 300, 120)),
  scenario('tier1_heavy_gunner_exposed', 'Tier 1: exposed heavy gunner line',
    squads('t1-heavy-exposed-a', 'attacker', 'heavy_gunner', 3, 180, 900, 120),
    squads('t1-heavy-marine-d', 'defender', 'marine', 3, 180, 300, 120)),
  scenario('tier1_jetpack_open_flank', 'Tier 1: jetpack open flank',
    [row('t1-jet-flank-a', 'attacker', 'jetpack_trooper', 520, 900), ...squads('t1-jet-flank-screen-a', 'attacker', 'marine', 2, 160, 900, 120)],
    [row('t1-jet-flank-sniper-d', 'defender', 'sniper', 520, 300), ...squads('t1-jet-flank-screen-d', 'defender', 'marine', 2, 160, 300, 120)]),
  scenario('tier1_jetpack_center_lane', 'Tier 1: jetpack forced through center',
    [row('t1-jet-center-a', 'attacker', 'jetpack_trooper', 340, 900), ...squads('t1-jet-center-screen-a', 'attacker', 'marine', 2, 160, 900, 120)],
    [row('t1-jet-center-sniper-d', 'defender', 'sniper', 520, 300), ...squads('t1-jet-center-screen-d', 'defender', 'marine', 2, 160, 300, 120)]),
  scenario('tier1_jetpack_vs_shock_screen', 'Tier 1: jetpack stopped after landing',
    squads('t1-jet-shock-a', 'attacker', 'jetpack_trooper', 3, 180, 900, 120),
    squads('t1-jet-shock-d', 'defender', 'shock_trooper', 3, 180, 300, 120)),
]

function scenario(id: string, name: string, attackers: UnitRow[], defenders: UnitRow[]): CombatBalanceScenario {
  return { id, name, attackers, defenders }
}

function squads(prefix: string, team: Team, unitType: UnitTypeKey, count: number, x: number, y: number, dx: number, hp = unitHp(unitType)): UnitRow[] {
  return Array.from({ length: count }, (_, index) => row(`${prefix}-${index}`, team, unitType, x + index * dx, y, hp))
}

function row(id: string, team: Team, unitType: UnitTypeKey, x: number, y: number, hp = unitHp(unitType)): UnitRow {
  return { id, colony_id: team, unit_type: unitType, hp_current: hp, tier: 1, upgrade_path: [], grid_x: String(x), grid_y: String(y) }
}

function unitHp(unitType: UnitTypeKey): number {
  return UNIT_TYPES[unitType].baseStats.hp
}

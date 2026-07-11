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
  scenario('tier1_heavy_gunner_sustained_line', 'Tier 1: heavy gunner sustained line',
    squads('t1-heavy-a', 'attacker', 'heavy_gunner', 3, 220, 820, 56),
    squads('t1-shock-d', 'defender', 'shock_trooper', 3, 220, 360, 48)),
  scenario('tier1_grenadier_vs_clump', 'Tier 1: grenadier versus clump',
    squads('t1-gren-a', 'attacker', 'grenadier', 3, 220, 820, 48),
    squads('t1-bug-d', 'defender', 'alien_bug', 5, 200, 360, 24)),
  scenario('tier1_grenadier_vs_spread', 'Tier 1: grenadier versus spread',
    squads('t1-gren-spread-a', 'attacker', 'grenadier', 3, 220, 820, 48),
    [
      row('t1-bug-spread-d-0', 'defender', 'alien_bug', 40, 320),
      row('t1-bug-spread-d-1', 'defender', 'alien_bug', 170, 390),
      row('t1-bug-spread-d-2', 'defender', 'alien_bug', 300, 460),
      row('t1-bug-spread-d-3', 'defender', 'alien_bug', 430, 340),
      row('t1-bug-spread-d-4', 'defender', 'alien_bug', 560, 410),
    ]),
  scenario('tier1_flamethrower_vs_swarm', 'Tier 1: flamethrower versus swarm',
    squads('t1-flame-a', 'attacker', 'flamethrower', 2, 230, 820, 54),
    squads('t1-swarm-d', 'defender', 'alien_bug', 4, 215, 370, 28)),
  scenario('tier1_flamethrower_vs_armored_screen', 'Tier 1: flamethrower versus armored screen',
    squads('t1-flame-armor-a', 'attacker', 'flamethrower', 3, 220, 820, 54),
    squads('t1-exo-d', 'defender', 'exosuit', 2, 230, 380, 60)),
  scenario('tier1_sapper_vs_static_guard', 'Tier 1: sapper versus static guard',
    squads('t1-sapper-a', 'attacker', 'sapper', 2, 240, 820, 42),
    [row('t1-wall-d-0', 'defender', 'wall', 240, 360)]),
  scenario('tier1_shock_trooper_vs_rifle_line', 'Tier 1: shock trooper versus rifle line',
    squads('t1-shock-a', 'attacker', 'shock_trooper', 3, 220, 820, 48),
    squads('t1-rifle-d', 'defender', 'marine', 4, 210, 360, 48)),
  scenario('tier1_jetpack_backline_access', 'Tier 1: jetpack backline access',
    squads('t1-jet-a', 'attacker', 'jetpack_trooper', 2, 220, 840, 48),
    [row('t1-sniper-d-0', 'defender', 'sniper', 220, 360), row('t1-turret-d-0', 'defender', 'turret', 285, 330)]),
  scenario('tier1_sniper_priority_target', 'Tier 1: sniper priority target',
    squads('t1-sniper-a', 'attacker', 'sniper', 2, 220, 820, 52),
    [row('t1-medic-d-0', 'defender', 'medic', 220, 360), ...squads('t1-screen-d', 'defender', 'marine', 2, 190, 330, 64)]),
  scenario('tier1_scout_drone_aa_check', 'Tier 1: scout drone anti-air check',
    squads('t1-scout-a', 'attacker', 'scout_drone', 3, 220, 820, 48),
    [row('t1-aa-d-0', 'defender', 'aa_turret', 220, 360)]),
  scenario('tier1_medic_sustain_check', 'Tier 1: medic sustain check',
    [row('t1-medic-a-0', 'attacker', 'medic', 205, 820), row('t1-wounded-a-0', 'attacker', 'marine', 245, 810, 12)],
    squads('t1-bug-medic-d', 'defender', 'alien_bug', 2, 225, 360, 36)),
  scenario('tier1_officer_aura_check', 'Tier 1: officer aura check',
    [row('t1-officer-a-0', 'attacker', 'officer', 210, 820), ...squads('t1-officer-line-a', 'attacker', 'marine', 2, 250, 815, 56)],
    squads('t1-officer-bug-d', 'defender', 'alien_bug', 3, 235, 360, 32)),
  scenario('tier1_buggy_charge_flank', 'Tier 1: scavenger buggy charge flank',
    squads('t1-buggy-a', 'attacker', 'scavenger_buggy', 2, 160, 840, 80),
    squads('t1-buggy-marine-d', 'defender', 'marine', 3, 260, 350, 52)),
  scenario('tier1_buggy_open_flank', 'Tier 1: scavenger buggy open flank',
    squads('t1-buggy-open-a', 'attacker', 'scavenger_buggy', 2, 160, 840, 110),
    [row('t1-buggy-open-sniper-d-0', 'defender', 'sniper', 245, 350), row('t1-buggy-open-medic-d-0', 'defender', 'medic', 315, 360)]),
  scenario('tier1_heavy_gunner_vs_marine_line', 'Tier 1: heavy gunner versus marine line',
    squads('t1-heavy-marine-a', 'attacker', 'heavy_gunner', 3, 220, 820, 56),
    squads('t1-heavy-marine-d', 'defender', 'marine', 4, 210, 360, 48)),
  scenario('tier1_shock_trooper_vs_grenadier_screen', 'Tier 1: shock trooper versus grenadier screen',
    squads('t1-shock-gren-a', 'attacker', 'shock_trooper', 3, 220, 820, 48),
    squads('t1-shock-gren-d', 'defender', 'grenadier', 2, 210, 360, 58)),
  scenario('tier1_sapper_vs_mobile_screen', 'Tier 1: sapper versus mobile screen',
    squads('t1-sapper-mobile-a', 'attacker', 'sapper', 2, 230, 820, 44),
    squads('t1-sapper-mobile-d', 'defender', 'shock_trooper', 3, 205, 360, 48)),
  scenario('tier1_jetpack_vs_aa_screen', 'Tier 1: jetpack versus anti-air screen',
    squads('t1-jet-aa-a', 'attacker', 'jetpack_trooper', 2, 220, 840, 48),
    [row('t1-jet-aa-d-0', 'defender', 'aa_turret', 240, 350), ...squads('t1-jet-aa-screen-d', 'defender', 'marine', 2, 185, 380, 70)]),
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

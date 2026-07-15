import { UNIT_TYPES } from './combat.config'
import type { Team, UnitRow, UnitTypeKey } from './combat.types'

export interface CombatP0RoleScenario {
  id: string
  name: string
  attackers: UnitRow[]
  defenders: UnitRow[]
}

export const P0_ROLE_SCENARIOS: CombatP0RoleScenario[] = [
  scenario('p0_emp_drone_control_window', 'P0: EMP drone control window',
    [row('p0-emp-a-drone-0', 'attacker', 'emp_drone', 245, 500), row('p0-emp-a-exo', 'attacker', 'exosuit', 315, 650)],
    [row('p0-emp-d-behemoth', 'defender', 'behemoth_tank', 270, 430)]),
  scenario('p0_emp_drone_baseline', 'P0 baseline: no EMP control window',
    [row('p0-emp-base-a-exo', 'attacker', 'exosuit', 315, 650)],
    [row('p0-emp-base-d-behemoth', 'defender', 'behemoth_tank', 270, 430)]),
  scenario('p0_hacker_redirect_window', 'P0: hacker redirect control window',
    [row('p0-hack-a-hacker', 'attacker', 'hacker_rover', 250, 720), row('p0-hack-a-exo', 'attacker', 'exosuit', 310, 690)],
    [row('p0-hack-d-behemoth', 'defender', 'behemoth_tank', 275, 430), ...squads('p0-hack-d-marine', 'defender', 'marine', 2, 240, 390, 48)]),
  scenario('p0_hacker_baseline', 'P0 baseline: no hacker redirect',
    [row('p0-hack-base-a-exo', 'attacker', 'exosuit', 310, 690)],
    [row('p0-hack-base-d-behemoth', 'defender', 'behemoth_tank', 275, 430), ...squads('p0-hack-base-d-marine', 'defender', 'marine', 2, 240, 390, 48)]),
  scenario('p0_radar_reveal_range_relay', 'P0: radar reveal and range relay',
    [row('p0-radar-a-radar', 'attacker', 'radar_zepplin', 250, 620), ...squads('p0-radar-a-sniper', 'attacker', 'sniper', 2, 220, 850, 60)],
    [row('p0-radar-d-stealth', 'defender', 'stealth_operative', 250, 430, undefined, ['stealth_cloak'])]),
  scenario('p0_radar_baseline', 'P0 baseline: no radar relay',
    squads('p0-radar-base-a-sniper', 'attacker', 'sniper', 2, 220, 850, 60),
    [row('p0-radar-base-d-stealth', 'defender', 'stealth_operative', 250, 430, undefined, ['stealth_cloak'])]),
  scenario('p0_officer_haste_formation', 'P0: officer haste formation',
    [row('p0-officer-a-officer', 'attacker', 'officer', 210, 820), ...squads('p0-officer-a-marine', 'attacker', 'marine', 3, 250, 815, 56)],
    squads('p0-officer-d-bugs', 'defender', 'alien_bug', 4, 235, 360, 32)),
  scenario('p0_officer_baseline', 'P0 baseline: no officer haste',
    squads('p0-officer-base-a-marine', 'attacker', 'marine', 3, 250, 815, 56),
    squads('p0-officer-base-d-bugs', 'defender', 'alien_bug', 4, 235, 360, 32)),
  scenario('p0_shield_emitter_projectile_guard', 'P0: shield emitter projectile guard',
    [row('p0-shield-a-missile', 'attacker', 'missile_buggy', 220, 820), row('p0-shield-a-artillery', 'attacker', 'artillery_crawler', 340, 860)],
    [row('p0-shield-d-shield', 'defender', 'shield_emitter', 270, 470), ...squads('p0-shield-d-marine', 'defender', 'marine', 2, 245, 430, 45)]),
  scenario('p0_shield_baseline', 'P0 baseline: no shield emitter guard',
    [row('p0-shield-base-a-missile', 'attacker', 'missile_buggy', 220, 820), row('p0-shield-base-a-artillery', 'attacker', 'artillery_crawler', 340, 860)],
    squads('p0-shield-base-d-marine', 'defender', 'marine', 2, 245, 430, 45)),
  scenario('p0_hologram_decoy_pressure', 'P0: hologram bounded decoy pressure',
    [row('p0-holo-a-hologram', 'attacker', 'hologram_projector', 250, 650, undefined, ['qa_fast_spawn_cap']), ...squads('p0-holo-a-marine', 'attacker', 'marine', 2, 220, 780, 56)],
    [row('p0-holo-d-railgun', 'defender', 'railgun_walker', 260, 390), row('p0-holo-d-gatling', 'defender', 'gatling_rover', 335, 410)]),
  scenario('p0_hologram_baseline', 'P0 baseline: no hologram decoys',
    squads('p0-holo-base-a-marine', 'attacker', 'marine', 2, 220, 780, 56),
    [row('p0-holo-base-d-railgun', 'defender', 'railgun_walker', 260, 390), row('p0-holo-base-d-gatling', 'defender', 'gatling_rover', 335, 410)]),
]

function scenario(id: string, name: string, attackers: UnitRow[], defenders: UnitRow[]): CombatP0RoleScenario {
  return { id, name, attackers, defenders }
}

function squads(prefix: string, team: Team, unitType: UnitTypeKey, count: number, x: number, y: number, dx: number, hp = unitHp(unitType)): UnitRow[] {
  return Array.from({ length: count }, (_, index) => row(`${prefix}-${index}`, team, unitType, x + index * dx, y, hp))
}

function row(id: string, team: Team, unitType: UnitTypeKey, x: number, y: number, hp = unitHp(unitType), upgradePath: string[] = []): UnitRow {
  return { id, colony_id: team, unit_type: unitType, hp_current: hp, tier: 1, upgrade_path: upgradePath, grid_x: String(x), grid_y: String(y) }
}

function unitHp(unitType: UnitTypeKey): number {
  return UNIT_TYPES[unitType].baseStats.hp
}

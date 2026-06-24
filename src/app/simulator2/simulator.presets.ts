import { getZergRushPreset } from '@/domains/combat/combat.presets'
import type { UnitRow } from '@/domains/combat/combat.types'

export function getSimulatorPreset(presetName: string): { attackers: UnitRow[], defenders: UnitRow[] } | null {
  if (presetName === 'zerg_rush') {
    return getZergRushPreset()
  } else if (presetName === 'ranged_duel') {
    return {
      attackers: Array.from({length: 10}).map((_,i) => ({ id: crypto.randomUUID(), colony_id: '1', unit_type: 'marine', hp_current: 100, tier: 1, upgrade_path: [], grid_x: String(100 + i*40), grid_y: String(800) })),
      defenders: Array.from({length: 10}).map((_,i) => ({ id: crypto.randomUUID(), colony_id: '2', unit_type: 'marine', hp_current: 100, tier: 1, upgrade_path: [], grid_x: String(100 + i*40), grid_y: String(200) }))
    }
  } else if (presetName === 'massive_clash') {
    return {
      attackers: Array.from({length: 50}).map((_,i) => ({ id: crypto.randomUUID(), colony_id: '1', unit_type: 'shock_trooper', hp_current: 250, tier: 1, upgrade_path: [], grid_x: String(100 + (i%10)*40), grid_y: String(800 + Math.floor(i/10)*40) })),
      defenders: Array.from({length: 50}).map((_,i) => ({ id: crypto.randomUUID(), colony_id: '2', unit_type: 'alien_bug', hp_current: 150, tier: 1, upgrade_path: [], grid_x: String(100 + (i%10)*40), grid_y: String(200 - Math.floor(i/10)*40) }))
    }
  }
  return null;
}

import type { UnitRow } from '@/domains/combat/combat.types'
import type { UnitsType } from '@/types/database'

export function generateNpcUnits(npcId: string): UnitRow[] {
  const units: UnitRow[] = []
  let idCounter = 1
  const add = (type: UnitsType, count: number, startX: number, startY: number, spacing: number) => {
    for (let i = 0; i < count; i++) {
      units.push({
        id: `npc_${idCounter++}`,
        colony_id: npcId,
        unit_type: type,
        hp_current: 9999, // engine uses baseStats.hp anyway, but this satisfies schema
        grid_x: String(startX + i * spacing),
        grid_y: String(startY),
        upgrade_path: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  }

  if (npcId === 'npc_outpost') {
    add('marine', 8, 300, 100, 40)
    add('turret', 2, 350, 50, 200)
  } else if (npcId === 'npc_raider') {
    add('scavenger_buggy', 4, 300, 100, 80)
    add('shock_trooper', 8, 350, 150, 40)
  } else if (npcId === 'npc_heavy') {
    add('siege_tank', 2, 300, 100, 150)
    add('wall', 8, 250, 80, 40)
    add('turret', 4, 350, 120, 100)
  } else if (npcId === 'npc_air') {
    add('drone', 6, 300, 100, 60)
    add('gunship', 2, 350, 150, 120)
    add('aa_turret', 2, 400, 100, 150)
  } else {
    add('drone', 5, 300, 100, 40)
  }
  return units
}

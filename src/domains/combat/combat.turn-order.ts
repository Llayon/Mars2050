import type { SimUnit } from './combat.sim.types'

/**
 * Builds a deterministic speed-first order without batching one team first.
 * Equal-speed units alternate initiative inside each attacker/defender pair.
 */
export function getCombatTurnOrder(units: SimUnit[]): SimUnit[] {
  const groups = new Map<number, SimUnit[]>()
  for (const unit of units) {
    if (unit.isDead) continue
    const group = groups.get(unit.speed) ?? []
    group.push(unit)
    groups.set(unit.speed, group)
  }

  const ordered: SimUnit[] = []
  const speeds = [...groups.keys()].sort((left, right) => right - left)
  for (const speed of speeds) {
    const group = groups.get(speed) ?? []
    const attackers = group.filter(unit => unit.team === 'attacker')
    const defenders = group.filter(unit => unit.team === 'defender')
    const pairCount = Math.max(attackers.length, defenders.length)

    for (let index = 0; index < pairCount; index++) {
      const pair = index % 2 === 0
        ? [attackers[index], defenders[index]]
        : [defenders[index], attackers[index]]
      for (const unit of pair) if (unit) ordered.push(unit)
    }
  }
  return ordered
}

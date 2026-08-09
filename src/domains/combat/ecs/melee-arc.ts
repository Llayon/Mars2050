export const MELEE_ARC_QUANTA = 24

export function getMeleeSectorSpan(unitRadius: number, targetRadius: number): number {
  const raw = Math.floor((2 * Math.PI * (targetRadius + unitRadius)) / (unitRadius * 2))
  const desired = Math.max(4, Math.min(12, raw))
  const slots = Math.floor(MELEE_ARC_QUANTA / Math.ceil(MELEE_ARC_QUANTA / desired))
  return Math.max(1, Math.ceil(MELEE_ARC_QUANTA / slots))
}

export function getPreferredMeleeSlot(approachAngle: number, span: number): number {
  const normalized = approachAngle < 0 ? approachAngle + Math.PI * 2 : approachAngle
  const center = Math.floor((normalized / (Math.PI * 2)) * MELEE_ARC_QUANTA)
  return (center - Math.floor(span / 2) + MELEE_ARC_QUANTA) % MELEE_ARC_QUANTA
}

export function getMeleeSlotCenterAngle(slot: number, span: number): number {
  return ((slot + span / 2) / MELEE_ARC_QUANTA) * Math.PI * 2
}

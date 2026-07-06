import type { SimUnit } from './combat.sim.types'
import { getDistance } from './combat.utils'

interface DamageSharingContext {
  units?: SimUnit[]
  onUnitDeath?: (unit: SimUnit) => void
}

export function applyDamageSharing(target: SimUnit, damage: number, context: DamageSharingContext): { damage: number; sharedDamage: number; events: { targetId: string; damage: number }[] } {
  const ratio = Math.max(0, Math.min(0.9, target.damageShareRatio ?? 0))
  if (damage <= 0 || ratio <= 0 || !target.damageShareRadius || !context.units) return { damage, sharedDamage: 0, events: [] }

  const recipients = context.units
    .filter(unit => !unit.isDead && unit.team === target.team && unit.id !== target.id && getDistance(unit.x, unit.y, target.x, target.y) <= target.damageShareRadius!)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, Math.max(1, target.damageShareMaxTargets ?? Number.MAX_SAFE_INTEGER))
  if (recipients.length === 0) return { damage, sharedDamage: 0, events: [] }

  const shareBudget = Math.floor(damage * ratio)
  const events = distributeSharedDamage(shareBudget, recipients, context)
  const sharedDamage = events.reduce((sum, event) => sum + event.damage, 0)
  return { damage: damage - sharedDamage, sharedDamage, events }
}

function distributeSharedDamage(shareBudget: number, recipients: SimUnit[], context: DamageSharingContext): { targetId: string; damage: number }[] {
  if (shareBudget <= 0) return []
  const baseDamage = Math.floor(shareBudget / recipients.length)
  let remainder = shareBudget % recipients.length
  const events: { targetId: string; damage: number }[] = []

  for (const recipient of recipients) {
    const damage = baseDamage + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    if (damage <= 0) continue
    recipient.hp -= damage
    events.push({ targetId: recipient.id, damage })
    if (recipient.hp <= 0 && !recipient.isDead) {
      if (context.onUnitDeath) context.onUnitDeath(recipient)
      else recipient.isDead = true
    }
  }
  return events
}

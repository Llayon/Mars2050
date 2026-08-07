import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { consumeShieldHitBlockCharge, setShield } from '../defense-resource-commit'

export interface EcsShieldDamageResult {
  intercepted: boolean
  damage: number
  shieldDamage: number
  shieldBroken: boolean
  shieldHitBlock: boolean
  shieldHitBlockedDamage: number
}

export function applyEcsShield(world: CombatWorld, targetId: EntityId, damage: number, shieldMultiplier = 1): EcsShieldDamageResult {
  const vitality = world.stores.vitality.require(targetId)
  if (vitality.shield <= 0) return { intercepted: false, damage, shieldDamage: 0, shieldBroken: false, shieldHitBlock: false, shieldHitBlockedDamage: 0 }
  const multiplier = Math.max(1, shieldMultiplier)
  const budget = Math.max(1, Math.floor(damage * multiplier))
  const currentShield = vitality.shield
  if (vitality.shield >= budget) {
    const nextShield = setShield(world, targetId, vitality.shield - budget)
    return { intercepted: false, damage: 0, shieldDamage: budget, shieldBroken: nextShield === 0, shieldHitBlock: false, shieldHitBlockedDamage: 0 }
  }
  setShield(world, targetId, 0)
  const overflow = Math.max(0, damage - Math.ceil(currentShield / multiplier))
  if (overflow > 0 && consumeShieldHitBlockCharge(world, targetId)) {
    return { intercepted: false, damage: 0, shieldDamage: currentShield, shieldBroken: true, shieldHitBlock: true, shieldHitBlockedDamage: overflow }
  }
  return { intercepted: false, damage: overflow, shieldDamage: currentShield, shieldBroken: true, shieldHitBlock: false, shieldHitBlockedDamage: 0 }
}

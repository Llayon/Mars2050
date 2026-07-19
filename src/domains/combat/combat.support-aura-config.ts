import type { SupportAura } from './combat.sim.types'
import { UPGRADES } from './combat.upgrades'

export function getUnitSupportAuras(
  baseAuras: SupportAura[] | undefined,
  upgradePath: unknown,
): SupportAura[] | undefined {
  const auras = baseAuras?.map(aura => ({ ...aura })) ?? []
  if (Array.isArray(upgradePath)) {
    for (const upgradeId of upgradePath) {
      if (typeof upgradeId !== 'string') continue
      const revealAura = UPGRADES[upgradeId]?.modifiers.grantRevealAura
      if (!revealAura) continue
      auras.push({
        type: 'reveal',
        radius: revealAura.radius,
        value: 0,
        duration: revealAura.duration,
        interval: revealAura.interval,
        target: 'enemies',
        targetTags: ['stealth'],
      })
    }
  }
  return auras.length > 0 ? auras : undefined
}

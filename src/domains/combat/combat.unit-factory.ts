import type { SimUnit } from './combat.sim.types'
import type { RuntimeUnitFactoryInput } from './combat.unit-build.types'
import type { UnitTypeKey } from './combat.types'
import { compileUnitSnapshot } from './combat.unit-compiler'

export type { RuntimeUnitFactoryInput } from './combat.unit-build.types'

export function createRuntimeUnitFromConfig(
  input: RuntimeUnitFactoryInput,
): SimUnit | null {
  const hp = input.hp === undefined ? undefined : Math.max(1, Math.floor(input.hp))
  const unit = compileUnitSnapshot({
    definitionId: input.type as UnitTypeKey,
    identity: {
      id: input.id,
      team: input.team,
      summonOwnerId: input.summonOwnerId,
      summonSourceId: input.summonSourceId,
    },
    loadout: { rank: 1, upgradeIds: [] },
    spawn: { inheritance: 'base' },
    placement: {
      x: input.x,
      y: input.y,
      angle: input.currentAngle,
    },
    overrides: {
      currentHp: hp,
      maxHp: hp,
      attack: input.attack,
      isTemporary: input.isTemporary,
      temporaryDuration: input.temporaryDuration,
    },
  })
  return unit
}

export function cloneRuntimeUnit(source: SimUnit, id: string, x: number, y: number): SimUnit {
  const clone = structuredClone(source)
  return {
    ...clone,
    id,
    hp: source.maxHp,
    x,
    y,
    actionCooldown: 0,
    shield: source.maxShield,
    statusEffects: [],
    targetMark: undefined,
    attackTargetId: undefined,
    meleeSlotTargetId: undefined,
    meleeSlotIndex: undefined,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    isDead: false,
    squadId: undefined,
  }
}

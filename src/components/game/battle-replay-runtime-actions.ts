import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleAction, BattleTick } from '@/domains/combat/combat.types'
import {
  createSpawnedUnit,
  handleAttackAction,
  handleDamageAction,
  handleLifestealAction,
  handleStatusAction,
} from './battle-replay-canvas-events'
import { applyReplayMovement } from './battle-replay-movement'
import {
  setReplayRuntimeUnit,
  type ReplayRuntimeRoster,
} from './battle-replay-runtime-roster'
import {
  markReplayUnitDeath,
  markReplayUnitMovement,
} from './battle-replay-visual-state'

type SpawnText =
  (text: string, x: number, y: number, color: string) => void
type SpawnProjectile =
  (x1: number, y1: number, x2: number, y2: number, color: string) => void

interface ReplayTickProcessorOptions {
  roster: ReplayRuntimeRoster
  spawnText: SpawnText
  spawnProjectile: SpawnProjectile
  spawnHazard: (action: BattleAction) => void
}

export function createReplayTickProcessor(
  options: ReplayTickProcessorOptions,
) {
  const movedUnitIds = new Set<string>()
  const { roster, spawnText, spawnProjectile, spawnHazard } = options
  const { units, unitList } = roster

  return function processReplayTick(
    battleTick: BattleTick,
    replayTimeMs: number,
    emitVisuals = true,
  ): void {
    const emitText = emitVisuals ? spawnText : ignoreReplayVisual
    const emitProjectile =
      emitVisuals ? spawnProjectile : ignoreReplayVisual
    prepareMovementFrame(unitList)
    movedUnitIds.clear()

    for (let index = 0; index < battleTick.actions.length; index++) {
      const action = battleTick.actions[index]
      const source = units[action.unitId]
      const target = action.targetId ? units[action.targetId] : undefined
      if (action.type === 'move' || action.type === 'knockback') {
        if (source) {
          applyReplayMovement(source, action, movedUnitIds)
          markReplayUnitMovement(
            source,
            action.fromX ?? source.sX,
            action.fromY ?? source.sY,
            action.toX ?? source.tX,
            action.toY ?? source.tY,
            replayTimeMs,
          )
        }
      } else if (action.type === 'attack' || action.type === 'heal') {
        handleAttackAction(
          action,
          source,
          target,
          emitText,
          emitProjectile,
          replayTimeMs,
        )
      } else if (
        action.type === 'damage' ||
        action.type === 'damage_share'
      ) {
        handleDamageAction(action, target, emitText, replayTimeMs)
      } else if (action.type === 'lifesteal') {
        handleLifestealAction(
          action,
          target ?? source,
          emitText,
          replayTimeMs,
        )
      } else if (action.type === 'die' && source) {
        source.isDead = true
        source.hp = 0
        source.deathAgeMs ??= 0
        markReplayUnitDeath(source, replayTimeMs)
        emitText('ВЫВЕДЕН', source.tX, source.tY, '#cbd5e1')
      } else if (action.type === 'spawn' && action.targetId) {
        setReplayRuntimeUnit(
          roster,
          createSpawnedUnit(action, replayTimeMs),
        )
        emitText(
          'СПАВН',
          action.toX ?? FIELD_WIDTH / 2,
          action.toY ?? FIELD_HEIGHT / 2,
          '#86efac',
        )
      } else if (action.type === 'hazard_spawn') {
        if (emitVisuals) spawnHazard(action)
      } else {
        handleStatusAction(
          action,
          source,
          target,
          emitText,
          emitProjectile,
        )
      }
    }
  }
}

function prepareMovementFrame(
  units: ReplayRuntimeRoster['unitList'],
): void {
  for (let index = 0; index < units.length; index++) {
    units[index].sX = units[index].tX
    units[index].sY = units[index].tY
  }
}

const ignoreReplayVisual = () => {}

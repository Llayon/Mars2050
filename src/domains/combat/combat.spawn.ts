import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'
import { FIELD_HEIGHT, FIELD_WIDTH, PRNG } from './combat.utils'
import { createRuntimeUnitFromConfig } from './combat.unit-factory'

export interface SpawnRequest {
  unitType: string
  count?: number
  cap?: number
  hpPercent?: number
  spreadRadius?: number
  sourceKey?: string
}

export function spawnCombatUnits(
  owner: SimUnit,
  anchor: SimUnit,
  request: SpawnRequest,
  units: SimUnit[],
  actions: BattleAction[],
  rng: PRNG,
  idPrefix: string
): SimUnit[] {
  const cap = request.cap ?? Number.MAX_SAFE_INTEGER
  const sourceKey = request.sourceKey ?? request.unitType
  const existing = units.filter(unit => !unit.isDead && unit.summonOwnerId === owner.id && unit.summonSourceId === sourceKey).length
  const count = Math.max(1, request.count ?? 1)
  const spawned: SimUnit[] = []

  for (let i = 0; i < count && existing + spawned.length < cap; i++) {
    const unit = createSpawnedUnit(owner, anchor, request, rng, idPrefix, sourceKey, i, count)
    if (!unit) continue
    units.push(unit)
    spawned.push(unit)
    actions.push({ unitId: owner.id, type: 'spawn', targetId: unit.id, toX: unit.x, toY: unit.y, spawnType: unit.type, spawnTeam: unit.team, spawnMaxHp: unit.maxHp })
  }

  if (spawned.length === 0 && cap !== Number.MAX_SAFE_INTEGER) actions.push({ unitId: owner.id, type: 'spawn_blocked', value: cap })
  return spawned
}

function createSpawnedUnit(owner: SimUnit, anchor: SimUnit, request: SpawnRequest, rng: PRNG, idPrefix: string, sourceKey: string, index: number, count: number): SimUnit | null {
  const position = getSpawnPosition(anchor, request.spreadRadius ?? 0, index, count)
  const base = createRuntimeUnitFromConfig({
    id: `${idPrefix}_${owner.id}_${sourceKey}_${Math.floor(rng.next() * 1000000)}`,
    team: owner.team,
    type: request.unitType,
    x: position.x,
    y: position.y,
    summonOwnerId: owner.id,
    summonSourceId: sourceKey,
    currentAngle: owner.currentAngle,
  })
  if (!base) return null
  if (request.hpPercent !== undefined) {
    base.hp = Math.max(1, Math.floor(base.maxHp * request.hpPercent))
    base.maxHp = base.hp
  }
  return base
}

function getSpawnPosition(anchor: SimUnit, spreadRadius: number, index: number, count: number): { x: number; y: number } {
  if (spreadRadius <= 0 || count <= 1) return { x: clampX(anchor.x), y: clampY(anchor.y) }
  const angle = (Math.PI * 2 * index) / count
  return { x: clampX(anchor.x + Math.cos(angle) * spreadRadius), y: clampY(anchor.y + Math.sin(angle) * spreadRadius) }
}

function clampX(value: number): number {
  return Math.max(0, Math.min(FIELD_WIDTH, value))
}

function clampY(value: number): number {
  return Math.max(0, Math.min(FIELD_HEIGHT, value))
}

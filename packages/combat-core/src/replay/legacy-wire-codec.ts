import {
  type CombatReplayUnit,
  type CombatRunResult,
  combatReplayUnitSchema,
  combatRunResultSchema,
} from '../contracts/index.js'

/**
 * Normalizes a unit snapshot to match the legacy Mars replay JSON field format.
 */
export function serializeLegacyUnit(unit: CombatReplayUnit): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: unit.id,
    type: unit.type,
    team: unit.team,
    hp: unit.hp,
    maxHp: unit.maxHp,
    x: unit.x,
    y: unit.y,
    attack: unit.attack,
    range: unit.range,
    speed: unit.speed,
  }
  if (unit.squadId !== undefined) result.squadId = unit.squadId
  if (unit.squadLeader !== undefined) result.squadLeader = unit.squadLeader
  if (unit.isTemporary !== undefined) result.isTemporary = unit.isTemporary
  if (unit.summonOwnerId !== undefined) result.summonOwnerId = unit.summonOwnerId
  if (unit.summonSourceId !== undefined) result.summonSourceId = unit.summonSourceId
  if (unit.shield !== undefined) result.shield = unit.shield
  if (unit.maxShield !== undefined) result.maxShield = unit.maxShield
  if (unit.direction !== undefined) result.direction = unit.direction
  if (unit.targetId !== undefined) result.targetId = unit.targetId
  return result
}

/**
 * Validates and decodes raw JSON into a typed CombatReplayUnit.
 */
export function deserializeLegacyUnit(input: unknown): CombatReplayUnit {
  return combatReplayUnitSchema.parse(input)
}

/**
 * Encodes a complete CombatRunResult into a deterministic JSON string.
 */
export function encodeLegacyReplayJson(result: CombatRunResult): string {
  return JSON.stringify(result)
}

/**
 * Decodes and validates a complete JSON replay string into a typed CombatRunResult.
 */
export function decodeLegacyReplayJson(json: string): CombatRunResult {
  const parsed = JSON.parse(json) as unknown
  return combatRunResultSchema.parse(parsed)
}

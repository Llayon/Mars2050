import { describe, expect, it } from 'vitest'
import {
  serializeCombatUnitSnapshot,
  deserializeCombatUnitSnapshot,
  decodeLegacyReplayJson,
  encodeLegacyReplayJson,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  type CombatRunResult,
} from '../src/contracts/index.js'
import { executeCombatSimulation } from '../src/combat.runner.js'

describe('R4a / ISO-10: DTO isolation and schema verification', () => {
  it('[P1] nested internal fields and sentinels are stripped and detached by reference', () => {
    const rawVelocity = { x: 120, y: 340, _internalVelSentinel: 'VEL_LEAK' }
    const rawStatusEffect = {
      type: 'emp',
      duration: 10,
      value: 5,
      _internalEffectSentinel: 'STATUS_LEAK',
    }
    const rawSnapshot: Record<string, unknown> = {
      id: 'unit_with_nested',
      team: 'attacker',
      type: 'trooper',
      x: 100,
      y: 200,
      hp: 50,
      maxHp: 50,
      velocity: rawVelocity,
      statusEffects: [rawStatusEffect],
      targetMark: {
        squadId: 'sq_1',
        markDuration: 20,
        _markSentinel: 'MARK_LEAK',
      },
    }

    const dto = serializeCombatUnitSnapshot(rawSnapshot)

    // Verify sentinels are removed
    expect('_internalVelSentinel' in (dto.velocity as Record<string, unknown>)).toBe(false)
    expect('_internalEffectSentinel' in (dto.statusEffects![0] as Record<string, unknown>)).toBe(false)
    expect('_markSentinel' in (dto.targetMark as Record<string, unknown>)).toBe(false)

    // Verify reference detachment (deep copy with fresh objects)
    expect(dto.velocity).not.toBe(rawVelocity)
    expect(dto.velocity).toEqual({ x: 120, y: 340 })
    expect(dto.statusEffects).not.toBe(rawSnapshot.statusEffects)
    expect(dto.statusEffects![0]).not.toBe(rawStatusEffect)
    expect(dto.statusEffects![0]).toEqual({ type: 'emp', duration: 10, value: 5 })
    expect(dto.targetMark).not.toBe(rawSnapshot.targetMark)
    expect(dto.targetMark).toEqual({ squadId: 'sq_1', markDuration: 20 })

    // Verify serialized JSON contains zero sentinel traces
    const json = JSON.stringify(dto)
    expect(json).not.toContain('VEL_LEAK')
    expect(json).not.toContain('STATUS_LEAK')
    expect(json).not.toContain('MARK_LEAK')
  })

  it('[P2] combatSnapshotUnitSchema strictly rejects corrupted data', () => {
    const baseValid = {
      id: 'u1',
      team: 'attacker',
      type: 'marine',
      x: 100,
      y: 200,
      hp: 50,
      maxHp: 50,
    }

    // Coordinates must be finite
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, x: Infinity })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, y: NaN })).toThrow()

    // HP must be finite, maxHp must be > 0
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, hp: NaN })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, maxHp: 0 })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, maxHp: -10 })).toThrow()

    // Numeric stats must be non-negative finite
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, attack: 'bad' })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, attack: -5 })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, defense: Infinity })).toThrow()

    // statusEffects must be an array of valid effect objects
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, statusEffects: 'not-an-array' })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, statusEffects: [{ type: 'burn', duration: NaN }] })).toThrow()

    // velocity must be a valid { x, y } object with no extra keys
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, velocity: 'invalid' })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, velocity: { x: Infinity, y: 10 } })).toThrow()
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, velocity: { x: 10, y: 10, _extra: 'leak' } })).toThrow()

    // Non-canonical keys must be rejected
    expect(() => combatSnapshotUnitSchema.parse({ ...baseValid, _internalEcsField: 'bad' })).toThrow()
  })

  it('[P2] decodeLegacyReplayJson purges internal unit and action sentinels', () => {
    const rawReplayJson = JSON.stringify({
      winner: 'defender',
      seed: 999,
      elapsedTicks: 10,
      terminationReason: 'timeout',
      initialState: [
        {
          id: 'u1',
          team: 'attacker',
          type: 'scout',
          x: 50,
          y: 60,
          hp: 30,
          maxHp: 30,
          _ecsInternalSentinel: 'STRIP_ME_FROM_UNIT',
        },
      ],
      survivors: [],
      logs: [
        {
          tick: 1,
          actions: [
            {
              unitId: 'u1',
              type: 'move',
              toX: 55,
              toY: 65,
              _actionInternalSentinel: 'STRIP_ME_FROM_ACTION',
            },
          ],
        },
      ],
      engineVersion: 9,
      engineRevision: 'combat-ecs-v9',
    })

    const decoded = decodeLegacyReplayJson(rawReplayJson)

    expect(decoded.initialState.length).toBe(1)
    expect('_ecsInternalSentinel' in (decoded.initialState[0] as Record<string, unknown>)).toBe(false)
    expect(decoded.logs[0].actions.length).toBe(1)
    expect('_actionInternalSentinel' in (decoded.logs[0].actions[0] as Record<string, unknown>)).toBe(false)

    // Round-trip re-encoded JSON contains zero sentinels
    const reEncoded = encodeLegacyReplayJson(decoded)
    expect(reEncoded).not.toContain('STRIP_ME_FROM_UNIT')
    expect(reEncoded).not.toContain('STRIP_ME_FROM_ACTION')
  })

  it('[P2] verifies all 4 combinations of rules.profile and rules.trackMetrics', () => {
    const run = (profile: boolean, trackMetrics: boolean): CombatRunResult => {
      return executeCombatSimulation({
        seed: 777,
        arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
        rules: {
          maxTicks: 3,
          timeoutPolicy: 'draw',
          defenseResolutionMode: 'v8_sequential',
          profile,
          trackMetrics,
        },
        definitions: {
          soldier: {
            id: 'soldier',
            name: 'Soldier',
            squadSize: 1,
            squadSpacing: 20,
            formation: 'grid',
            baseStats: {
              hp: 50,
              attack: 10,
              defense: 2,
              speed: 3,
              range: 4,
              attackType: 'single',
              actionCooldownMax: 10,
              turnSpeed: 5,
              size: 'M',
              combatTags: [],
            },
            hireCost: {},
          },
        },
        units: [
          { instanceId: 'a1', definitionId: 'soldier', team: 'attacker', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
          { instanceId: 'd1', definitionId: 'soldier', team: 'defender', placement: { x: 300, y: 500 }, rank: 1, upgradeIds: [] },
        ],
        scheduledEffects: [],
      })
    }

    // Combination 1: profile: false, trackMetrics: false
    const res1 = run(false, false)
    expect(res1.profile).toBeUndefined()
    expect(res1.metrics).toBeUndefined()

    // Combination 2: profile: true, trackMetrics: false
    const res2 = run(true, false)
    expect(res2.profile).toBeDefined()
    expect(res2.metrics).toBeUndefined()

    // Combination 3: profile: false, trackMetrics: true (profile MUST remain strictly undefined)
    const res3 = run(false, true)
    expect(res3.profile).toBeUndefined()
    expect(res3.metrics).toBeDefined()

    // Combination 4: profile: true, trackMetrics: true
    const res4 = run(true, true)
    expect(res4.profile).toBeDefined()
    expect(res4.metrics).toBeDefined()
  })
})

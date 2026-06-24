import { describe, it, expect } from 'vitest'
import { buildingCreateSchema } from '@/domains/building/building.schemas'
import { discoverLocationSchema } from '@/domains/map/map.schemas'
import { colonyInitSchema, colonyCreateSchema } from '@/domains/colony/colony.schemas'
import { attackSchema, tradeSchema } from '@/domains/pvp/pvp.schemas'
import { resourceUpdateSchema } from '@/domains/resource/resource.schemas'

describe('building.schemas', () => {
  const valid = { colonyId: '550e8400-e29b-41d4-a716-446655440000', type: 'solar_panels', name: 'Test', x: 10, y: 20 }

  it('accepts valid building creation', () => {
    expect(buildingCreateSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid colony ID', () => {
    const result = buildingCreateSchema.safeParse({ ...valid, colonyId: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid building type', () => {
    const result = buildingCreateSchema.safeParse({ ...valid, type: 'nuclear_reactor' })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = buildingCreateSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('map.schemas', () => {
  it('accepts valid location discovery', () => {
    const result = discoverLocationSchema.safeParse({
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      colonyId: '550e8400-e29b-41d4-a716-446655440001'
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = discoverLocationSchema.safeParse({
      locationId: 'not-a-uuid',
      colonyId: 'not-a-uuid'
    })
    expect(result.success).toBe(false)
  })
})

describe('colony.schemas', () => {
  it('colonyInitSchema accepts valid UUID', () => {
    const result = colonyInitSchema.safeParse({
      colonyId: '550e8400-e29b-41d4-a716-446655440000'
    })
    expect(result.success).toBe(true)
  })

  it('colonyCreateSchema accepts valid UUID', () => {
    const result = colonyCreateSchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000'
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing fields', () => {
    expect(colonyInitSchema.safeParse({}).success).toBe(false)
    expect(colonyCreateSchema.safeParse({}).success).toBe(false)
  })
})

describe('pvp.schemas', () => {
  it('attackSchema validates required fields', () => {
    const result = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
  })

  it('attackSchema accepts clientSeed as positive integer', () => {
    const result = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
      clientSeed: 99,
    })
    expect(result.success).toBe(true)
  })

  it('attackSchema rejects negative or fractional clientSeed', () => {
    const neg = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
      clientSeed: -1,
    })
    expect(neg.success).toBe(false)
    const frac = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
      clientSeed: 1.5,
    })
    expect(frac.success).toBe(false)
  })

  it('attackSchema enforces grid placement bounds', () => {
    const ok = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
      attackerUnitsPlacement: [{ unitId: '550e8400-e29b-41d4-a716-446655440000', x: 0, y: 16 }],
    })
    expect(ok.success).toBe(true)

    const bad = attackSchema.safeParse({
      attackerColonyId: '550e8400-e29b-41d4-a716-446655440000',
      defenderColonyId: '550e8400-e29b-41d4-a716-446655440001',
      attackerUnitsPlacement: [{ unitId: '550e8400-e29b-41d4-a716-446655440000', x: 99, y: 16 }],
    })
    expect(bad.success).toBe(false)
  })

  it('tradeSchema validates required fields', () => {
    const result = tradeSchema.safeParse({
      fromColonyId: '550e8400-e29b-41d4-a716-446655440000',
      toColonyId: '550e8400-e29b-41d4-a716-446655440001',
      offerResources: { energy: 50 }
    })
    expect(result.success).toBe(true)
  })

  it('tradeSchema rejects negative resource amounts', () => {
    const result = tradeSchema.safeParse({
      fromColonyId: '550e8400-e29b-41d4-a716-446655440000',
      toColonyId: '550e8400-e29b-41d4-a716-446655440001',
      offerResources: { energy: -10 }
    })
    expect(result.success).toBe(false)
  })
})

describe('resource.schemas', () => {
  it('accepts valid resource update with add operation', () => {
    const result = resourceUpdateSchema.safeParse({
      colonyId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'energy',
      amount: 100,
      operation: 'add'
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative amount', () => {
    const result = resourceUpdateSchema.safeParse({
      colonyId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'energy',
      amount: -5,
      operation: 'add'
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid resource type', () => {
    const result = resourceUpdateSchema.safeParse({
      colonyId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'gold',
      amount: 10,
      operation: 'add'
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid operation', () => {
    const result = resourceUpdateSchema.safeParse({
      colonyId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'energy',
      amount: 10,
      operation: ' multiply'
    })
    expect(result.success).toBe(false)
  })
})
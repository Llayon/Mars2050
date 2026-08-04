import { describe, expect, it } from 'vitest'
import { PendingImpactQueue } from '@/domains/combat/ecs/pending-impacts'

describe('combat ECS v8 temporal delivery', () => {
  it('keeps impacts ordered by stable id inside the same tick', () => {
    const queue = new PendingImpactQueue()
    const base = {
      sourceId: 1, sourceExternalId: 'a', sourceTeam: 'attacker' as const,
      targetX: 10, targetY: 10, launchTick: 2, impactTick: 5,
      kind: 'projectile' as const, directDamage: 10, areaDamage: 0,
      areaRadius: 0, interceptable: true,
    }
    const first = queue.enqueue(base)
    const second = queue.enqueue({ ...base, sourceExternalId: 'b' })
    expect(queue.take(5).map(impact => impact.id)).toEqual([first.id, second.id])
    expect(queue.hasDamagePending()).toBe(false)
  })

  it('does not expose future impacts before their tick', () => {
    const queue = new PendingImpactQueue()
    queue.enqueue({
      sourceId: 1, sourceExternalId: 'a', sourceTeam: 'attacker', targetX: 0, targetY: 0,
      launchTick: 1, impactTick: 4, kind: 'ground_targeted', directDamage: 8,
      areaDamage: 4, areaRadius: 30, interceptable: true,
    })
    expect(queue.take(3)).toEqual([])
    expect(queue.hasDamagePending()).toBe(true)
  })
})

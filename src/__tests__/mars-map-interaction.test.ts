import { describe, it, expect, vi } from 'vitest'
import { Container } from 'pixi.js'
import { setupMapInteraction } from '@/components/map/mars-map-interaction'
import type { MapLocation } from '@/domains/map/map.types'

describe('mars-map-interaction', () => {
  const sampleLocations: MapLocation[] = [
    {
      id: 'loc-1',
      x: 1,
      y: 1,
      type: 'crater',
      name: 'Crater Alpha',
      difficulty: 1,
      is_discovered: true,
      resources: { minerals: 100 },
      created_at: new Date().toISOString()
    },
    {
      id: 'loc-2',
      x: 5,
      y: 8,
      type: 'mountains',
      name: 'Ridge Beta',
      difficulty: 2,
      is_discovered: false,
      resources: {},
      created_at: new Date().toISOString()
    }
  ]

  it('selects matching location on viewport clicked event', () => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
    const mockViewport = {
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] || []
        listeners[event].push(fn)
      }),
      off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(l => l !== fn)
        }
      })
    }

    const interactionLayer = new Container()
    const onSelect = vi.fn()

    const manager = setupMapInteraction(
      mockViewport as never,
      interactionLayer,
      sampleLocations,
      128,
      { width: 20, height: 20 },
      onSelect
    )

    expect(mockViewport.on).toHaveBeenCalledWith('clicked', expect.any(Function))

    // Click at world (190, 190) -> cell (1, 1) -> loc-1
    const clickHandler = listeners['clicked'][0]
    clickHandler({ world: { x: 190, y: 190 } })

    expect(onSelect).toHaveBeenCalledWith(sampleLocations[0])

    // Click at world (50, 50) -> cell (0, 0) -> no location there -> null
    clickHandler({ world: { x: 50, y: 50 } })
    expect(onSelect).toHaveBeenCalledWith(null)

    // Click out of bounds (3000, 3000) -> null
    clickHandler({ world: { x: 3000, y: 3000 } })
    expect(onSelect).toHaveBeenCalledWith(null)

    // setSelectedLocation updates selection
    manager.setSelectedLocation(sampleLocations[1])

    manager.destroy()
    expect(mockViewport.off).toHaveBeenCalledWith('clicked', expect.any(Function))
  })
})

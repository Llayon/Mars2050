import { describe, expect, it } from 'vitest'
import { Cache, Container, Texture } from 'pixi.js'
import type {
  OverlayState,
  ReplayUnit,
} from '@/components/game/battle-replay-canvas-types'
import type { ReplayCrowdUnitView } from '@/components/game/battle-replay-density'
import { createReplayRenderCounters } from '@/components/game/battle-replay-profile'
import { createPixiReplayScene } from '@/components/game/battle-replay-pixi-scene'
import { syncPixiReplayUnits } from '@/components/game/battle-replay-pixi-units'
import { createReplayUnitVisualState } from '@/components/game/battle-replay-visual-state'

const budget = {
  resolution: 1,
  maxFps: 60,
  clusterUnitStride: 1,
  corpseLifetimeMs: 1000,
  maxFloatingTexts: 120,
}
const overlays: OverlayState = {
  radius: false,
  velocity: false,
  targets: false,
}

function createUnit(): ReplayUnit {
  return {
    id: 'unit-1',
    type: 'missing_visual_fixture',
    team: 'attacker',
    hp: 100,
    maxHp: 100,
    size: 'S',
    sX: 10,
    sY: 100,
    tX: 10,
    tY: 100,
    isDead: false,
    isFlying: false,
    emp: false,
    stealth: false,
    flash: 0,
    visual: createReplayUnitVisualState('attacker'),
  }
}

function createView(x = 10, y = 100): ReplayCrowdUnitView {
  return { id: 'unit-1', x, y, radius: 12, mode: 'full' }
}

describe('retained Pixi replay units', () => {
  it('moves the container without rebuilding unchanged unit geometry', () => {
    const scene = createPixiReplayScene(new Container(), [])
    const unit = createUnit()
    const first = createReplayRenderCounters()
    scene.renderFrame = 1
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
      first,
    )

    const display = scene.unitDisplays[0]
    expect(display.layer.position).toMatchObject({ x: 10, y: 100 })
    expect(display.layer.zIndex).toBe(100)
    expect(display.fallback?.position).toMatchObject({ x: 0, y: 0 })
    expect(first.fallbackRebuilds).toBe(1)
    expect(first.hpRebuilds).toBe(1)

    const moved = createReplayRenderCounters()
    scene.renderFrame = 2
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView(30, 145)],
      overlays,
      budget,
      0,
      moved,
    )

    expect(display.layer.position).toMatchObject({ x: 30, y: 145 })
    expect(display.layer.zIndex).toBe(145)
    expect(moved.positionChanges).toBe(1)
    expect(moved.depthChanges).toBe(1)
    expect(moved.fallbackRebuilds).toBe(0)
    expect(moved.hpRebuilds).toBe(0)
    expect(moved.flashRebuilds).toBe(0)
  })

  it('updates only primitives affected by HP and overlay state', () => {
    const scene = createPixiReplayScene(new Container(), [])
    const unit = createUnit()
    scene.renderFrame = 1
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
    )

    unit.hp = 40
    const damaged = createReplayRenderCounters()
    scene.renderFrame = 2
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
      damaged,
    )
    expect(damaged.hpRebuilds).toBe(1)
    expect(damaged.fallbackRebuilds).toBe(0)
    expect(damaged.spriteChanges).toBe(0)

    unit.tX = 30
    const overlayChange = createReplayRenderCounters()
    scene.renderFrame = 3
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      { ...overlays, radius: true, velocity: true },
      budget,
      0,
      overlayChange,
    )
    expect(overlayChange.hitboxRebuilds).toBe(1)
    expect(overlayChange.velocityRebuilds).toBe(1)

    const stable = createReplayRenderCounters()
    scene.renderFrame = 4
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      { ...overlays, radius: true, velocity: true },
      budget,
      0,
      stable,
    )
    expect(stable.hitboxRebuilds).toBe(0)
    expect(stable.velocityRebuilds).toBe(0)
    expect(stable.hpRebuilds).toBe(0)
  })

  it('keeps only sprite and HP sprites for a regular visual unit', () => {
    const assetPath = '/sprites/marine/rotations/north.png'
    Cache.set(assetPath, Texture.WHITE)
    const scene = createPixiReplayScene(new Container(), [])
    const unit = {
      ...createUnit(),
      type: 'marine',
    }
    scene.renderFrame = 1
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
    )

    const display = scene.unitDisplays[0]
    expect(display.layer.children).toHaveLength(3)
    expect(display.fallback).toBeNull()
    expect(display.flash).toBeNull()
    expect(display.label).toBeNull()
    expect(scene.unitOptionalPool.activeGraphics).toBe(0)
    expect(scene.unitOptionalPool.activeTexts).toBe(0)

    unit.flash = 1
    scene.renderFrame = 2
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
    )
    expect(display.layer.children).toHaveLength(4)
    expect(scene.unitOptionalPool.activeGraphics).toBe(1)

    unit.flash = 0
    scene.renderFrame = 3
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
    )
    expect(display.layer.children).toHaveLength(3)
    expect(scene.unitOptionalPool.activeGraphics).toBe(0)
    expect(scene.unitOptionalPool.graphics).toHaveLength(1)

    unit.flash = 1
    scene.renderFrame = 4
    syncPixiReplayUnits(
      scene,
      [unit],
      [createView()],
      overlays,
      budget,
      0,
    )
    expect(scene.unitOptionalPool.allocatedGraphics).toBe(1)
    Cache.remove(assetPath)
  })
})

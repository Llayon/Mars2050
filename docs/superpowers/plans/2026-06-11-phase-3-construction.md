# Phase 3: Building Placement (Drag-and-Drop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to select a building to construct, see a translucent 'ghost' that snaps to the isometric grid following their cursor, and confirm placement to construct the building via the API.

**Architecture:** 
1. **React State:** Introduce `placementMode` state in `ColonyScreen` (stores the `BuildingTypeKey` being placed).
2. **PixiJS Ghost:** Pass `placementMode` down to `ColonyCanvas`. When active, render a special `GhostBuilding` sprite that follows the pointer.
3. **Snapping & Validation:** Use `screenToGrid` to snap the ghost to grid cells. Check against `RENDER_LIMITS.MAP_SIZE` and existing `buildings` to prevent overlapping or out-of-bounds placement. Paint it green if valid, red if invalid.
4. **Action Bridge:** On pointer click (if placement is valid), call a new `onConfirmPlacement(x, y)` callback which triggers the `buildStructure` API call in React.

**Tech Stack:** React, PixiJS v8 (`@pixi/react`), Supabase API.

---

### Task 1: Create Ghost Building Component

**Files:**
- Create: `src/components/colony/sprites/ghost-building.tsx`

- [ ] **Step 1: Write the GhostBuilding component**

```tsx
import { useCallback, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingTypeKey, BuildingRow } from '@/domains/building/building.types'
import { RENDER_LIMITS } from '@/domains/building/building.config'

interface GhostBuildingProps {
  type: BuildingTypeKey
  existingBuildings: BuildingRow[]
  app: PIXI.Application
  world: PIXI.Container
  onConfirm: (x: number, y: number) => void
}

export function GhostBuilding({ type, existingBuildings, app, world, onConfirm }: GhostBuildingProps) {
  const [gridPos, setGridPos] = useState({ x: 10, y: 10 })
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      // Get global pointer position and convert to world container local space
      const localPos = world.toLocal(e.global)
      
      // Snap to grid
      const snapped = screenToGrid(localPos.x, localPos.y)
      
      // Boundary check
      const { MAP_SIZE } = RENDER_LIMITS
      let valid = snapped.x >= 0 && snapped.x <= MAP_SIZE && snapped.y >= 0 && snapped.y <= MAP_SIZE
      
      // Overlap check
      if (valid) {
        const overlap = existingBuildings.some(b => b.x === snapped.x && b.y === snapped.y)
        if (overlap) valid = false
      }

      setGridPos(snapped)
      setIsValid(valid)
    }

    const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
      if (isValid) {
        onConfirm(gridPos.x, gridPos.y)
      }
    }

    app.stage.on('pointermove', handlePointerMove)
    app.stage.on('pointerdown', handlePointerDown)

    return () => {
      app.stage.off('pointermove', handlePointerMove)
      app.stage.off('pointerdown', handlePointerDown)
    }
  }, [app, world, existingBuildings, isValid, gridPos, onConfirm])

  const drawGhost = useCallback((g: PIXI.Graphics) => {
    g.clear()
    const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
    const h = 30
    const w2 = TILE_WIDTH / 2
    const h2 = TILE_HEIGHT / 2
    
    // Color: Green if valid, Red if invalid
    const color = isValid ? 0x00ff00 : 0xff0000

    g.moveTo(0, -TILE_HEIGHT/2 - 20)
    g.lineTo(w2, -20)
    g.lineTo(0, h2 - 20)
    g.lineTo(-w2, -20)
    g.closePath()
    g.fill({ color, alpha: 0.5 })
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
    
    g.rect(-w2, -20, w2, 20)
    g.fill({ color, alpha: 0.3 })
    g.rect(0, -20, w2, 20)
    g.fill({ color, alpha: 0.2 })
  }, [isValid])

  const screenPos = gridToScreen(gridPos.x + 0.5, gridPos.y + 0.5)

  return (
    <pixiGraphics
      x={screenPos.x}
      y={screenPos.y}
      zIndex={9999} // Always on top
      draw={drawGhost}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/colony/sprites/ghost-building.tsx
git commit -m "feat(colony): create GhostBuilding component for placement mode"
```

### Task 2: Integrate Placement Mode in ColonyCanvas

**Files:**
- Modify: `src/components/screens/ColonyCanvas.tsx`

- [ ] **Step 1: Add placementMode props and Ghost render**

Update props to accept `placementMode` and `onConfirmPlacement`.
Render `GhostBuilding` manually inside the `useEffect` since we are imperative.

```tsx
// 1. Add imports
import type { BuildingTypeKey } from '@/domains/building/building.types'
import { GhostBuilding } from '@/components/colony/sprites/ghost-building'
import { createRoot } from 'react-dom/client' // For mounting react inside imperative pixi if needed, OR rewrite Ghost imperative. Let's rewrite Ghost imperative to avoid React-DOM mixing inside Pixi.

// Actually, since our ColonyCanvas uses `useEffect` for pure PixiJS, it's safer to implement Ghost imperative inside ColonyCanvas directly.

// ... Update ColonyCanvas props:
export default function ColonyCanvas({ 
  buildings, 
  onBuildingClick,
  placementMode,
  onConfirmPlacement
}: { 
  buildings: BuildingRow[]
  onBuildingClick: (building: BuildingRow) => void 
  placementMode: BuildingTypeKey | null
  onConfirmPlacement: (x: number, y: number) => void
}) {
```

- [ ] **Step 2: Implement Imperative Ghost logic inside useEffect**

Add this block inside the `useEffect` after rendering buildings:

```typescript
        // --- PLACEMENT GHOST ---
        let ghostGraphics: PIXI.Graphics | null = null;
        let ghostValid = false;
        let ghostGridX = 0;
        let ghostGridY = 0;

        if (placementMode) {
          ghostGraphics = new PIXI.Graphics()
          ghostGraphics.zIndex = 9999
          world.addChild(ghostGraphics)

          const updateGhost = (e: PIXI.FederatedPointerEvent) => {
            if (!ghostGraphics) return
            const localPos = world.toLocal(e.global)
            const snapped = screenToGrid(localPos.x, localPos.y)
            ghostGridX = snapped.x
            ghostGridY = snapped.y
            
            const { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
            let valid = snapped.x >= 0 && snapped.x <= MAP_SIZE && snapped.y >= 0 && snapped.y <= MAP_SIZE
            if (valid) {
              const overlap = buildings.some(b => b.x === snapped.x && b.y === snapped.y)
              if (overlap) valid = false
            }
            ghostValid = valid

            const pos = gridToScreen(snapped.x + 0.5, snapped.y + 0.5)
            ghostGraphics.x = pos.x
            ghostGraphics.y = pos.y

            const color = valid ? 0x00ff00 : 0xff0000
            const w2 = TILE_WIDTH / 2; const h2 = TILE_HEIGHT / 2; const h = 30

            ghostGraphics.clear()
            ghostGraphics.moveTo(0, -h2 - 20).lineTo(w2, -20).lineTo(0, h2 - 20).lineTo(-w2, -20).closePath()
            ghostGraphics.fill({ color, alpha: 0.5 })
            ghostGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
            ghostGraphics.rect(-w2, -20, w2, 20).fill({ color, alpha: 0.3 })
            ghostGraphics.rect(0, -20, w2, 20).fill({ color, alpha: 0.2 })
          }

          app.stage.on('pointermove', updateGhost)
          // Initial draw
          updateGhost({ global: { x: app.screen.width/2, y: app.screen.height/2 } } as any)
        }
```

- [ ] **Step 3: Update Interaction Handlers**

Modify the existing `pointerdown` and `pointerup` handlers to support placement:

```typescript
        app.stage.on('pointerup', (e) => {
          if (placementMode && ghostValid && !isDragging.current) {
            // Calculate distance to ensure it wasn't a pan
            const dx = e.global.x - lastPos.current.x
            const dy = e.global.y - lastPos.current.y
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
               onConfirmPlacement(ghostGridX, ghostGridY)
            }
          }
          isDragging.current = false 
        })
```

- [ ] **Step 4: Commit**

Delete `ghost-building.tsx` if created in Step 1 (we went imperative instead).
```bash
git rm -f src/components/colony/sprites/ghost-building.tsx
git add src/components/screens/ColonyCanvas.tsx
git commit -m "feat(colony): implement imperative placement ghost in PixiJS"
```

### Task 3: Plumb Placement Mode in React

**Files:**
- Modify: `src/components/screens/ColonyScreen.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/hooks/useBuildings.ts`

- [ ] **Step 1: Update useBuildings to accept coordinates**

In `src/hooks/useBuildings.ts`, modify `buildStructure`:
```typescript
  const buildStructure = useCallback(async (type: BuildingTypeKey, x?: number, y?: number) => {
    // ... inside api call
    const res = await fetch('/api/buildings', {
      method: 'POST',
      body: JSON.stringify({ colonyId, type, x: x ?? 10, y: y ?? 10 }), // fallback to 10 for classic view
    })
```

- [ ] **Step 2: Update ColonyScreen to handle placement state**

```tsx
// In ColonyScreen.tsx
  const [placementMode, setPlacementMode] = useState<BuildingTypeKey | null>(null)

  const handleConfirmPlacement = async (x: number, y: number) => {
    if (!placementMode) return
    // Assuming onBuild is passed from page.tsx
    await onBuild(placementMode, x, y)
    setPlacementMode(null) // Exit placement mode
  }
```

Update `ColonyCanvas` render:
```tsx
        <ColonyCanvas 
           buildings={buildings} 
           onBuildingClick={setSelectedBuilding}
           placementMode={placementMode}
           onConfirmPlacement={handleConfirmPlacement}
        />
```

- [ ] **Step 3: Update page.tsx to pass onBuild to ColonyScreen**

```tsx
  // Common props for ColonyScreen
  const colonyScreenProps = {
    // ...
    onBuild: handleBuild
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/ColonyScreen.tsx src/app/page.tsx src/hooks/useBuildings.ts
git commit -m "feat(colony): wire up placement mode state and api calls"
```

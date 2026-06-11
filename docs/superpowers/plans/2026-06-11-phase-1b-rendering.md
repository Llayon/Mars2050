# Phase 1b: Rendering Existing Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read building data from the database and render them as colored placeholder sprites on the PixiJS isometric grid with correct depth sorting.

**Architecture:** Use a dedicated PixiJS Container for buildings. Iterate through the `buildings` array, calculate screen coordinates from isometric `(x,y)` using `gridToScreen`, and calculate `zIndex` using `calculateZIndex`. Use `PIXI.Graphics` to draw colored boxes representing different building types as placeholders. Enable `sortableChildren` on the container to automatically handle depth sorting.

**Tech Stack:** React, PixiJS v8 (`@pixi/react`), Supabase.

---

### Task 1: Create Placeholder Sprite Factory

**Files:**
- Create: `src/components/colony/sprites/SpriteFactory.tsx`

- [ ] **Step 1: Write the SpriteFactory component**

```tsx
import { useCallback, useMemo } from 'react'
import { Graphics } from '@pixi/react'
import * as PIXI from 'pixi.js'
import type { BuildingRow } from '@/domains/building/building.types'
import { gridToScreen, calculateZIndex } from '@/domains/building/building.isometric'
import { RENDER_LIMITS } from '@/domains/building/building.config'

interface SpriteFactoryProps {
  buildings: BuildingRow[]
}

// Temporary color mapping for placeholders
const TYPE_COLORS: Record<string, number> = {
  solar_panels: 0xFFD700, // Yellow
  oxygen_generator: 0x87CEEB, // Light Blue
  water_extractor: 0x4169E1, // Royal Blue
  mine: 0x8B4513, // Saddle Brown
  greenhouse: 0x32CD32, // Lime Green
  research_lab: 0x9370DB, // Medium Purple
}

export function SpriteFactory({ buildings }: SpriteFactoryProps) {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS

  // We use useMemo to avoid recreating the graphics array on every tiny render unless buildings change
  const renderedBuildings = useMemo(() => {
    // Enforce rendering limits
    const buildingsToRender = buildings.slice(0, RENDER_LIMITS.MAX_SPRITES)

    return buildingsToRender.map((building) => {
      const pos = gridToScreen(building.x, building.y)
      const zIndex = calculateZIndex(building.x, building.y)
      const color = TYPE_COLORS[building.type] || 0xFFFFFF

      const drawPlaceholder = (g: PIXI.Graphics) => {
        g.clear()

        // Draw an isometric "box" placeholder
        // Base (Diamond)
        g.moveTo(0, -TILE_HEIGHT / 2)
        g.lineTo(TILE_WIDTH / 2, 0)
        g.lineTo(0, TILE_HEIGHT / 2)
        g.lineTo(-TILE_WIDTH / 2, 0)
        g.closePath()
        g.fill({ color, alpha: 0.8 })
        g.stroke({ width: 1, color: 0x000000, alpha: 0.5 })

        // Height (Cube) - just a simple rectangle going up
        g.rect(-TILE_WIDTH/4, -TILE_HEIGHT, TILE_WIDTH/2, TILE_HEIGHT)
        g.fill({ color, alpha: 0.6 })
      }
      return (
        <pixiGraphics
          key={building.id}
          x={pos.x}
          y={pos.y}
          zIndex={zIndex}
          draw={drawPlaceholder}
        />
      )
    })
  }, [buildings, TILE_WIDTH, TILE_HEIGHT])

  return (
    <pixiContainer sortableChildren={true}>
      {renderedBuildings}
    </pixiContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/colony/sprites/SpriteFactory.tsx
git commit -m "feat(colony): create SpriteFactory for rendering placeholder buildings"
```

### Task 2: Integrate SpriteFactory into ColonyCanvas

**Files:**
- Modify: `src/components/screens/ColonyCanvas.tsx`

- [ ] **Step 1: Pass buildings prop and render SpriteFactory**

```tsx
// 1. Add imports at the top
import { SpriteFactory } from '@/components/colony/sprites/SpriteFactory'
import type { BuildingRow } from '@/domains/building/building.types'

// 2. Update props interface
export default function ColonyCanvas({ buildings }: { buildings: BuildingRow[] }) {
  // ... existing state and hooks
```

```tsx
// 3. Render it inside the Viewport, after DebugGrid
        <pixiViewport
          // ... existing props
        >
          <DebugGrid />
          <SpriteFactory buildings={buildings} />
        </pixiViewport>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/ColonyCanvas.tsx
git commit -m "feat(colony): integrate SpriteFactory into ColonyCanvas"
```

### Task 3: Pass Building Data from Screen to Canvas

**Files:**
- Modify: `src/components/screens/ColonyScreen.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update ColonyScreen to accept and pass buildings**

```tsx
// 1. Update ColonyScreenProps in src/components/screens/ColonyScreen.tsx
interface ColonyScreenProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[] // Add this line
  resources: ResourceRow[]
  resourcesLoading: boolean
  onLogout: () => void
  children?: React.ReactNode
}

// 2. Destructure buildings
export default function ColonyScreen({ 
  colonyId, 
  colony, 
  colonyLoading, 
  buildings, // Add this
  resources, 
  // ...
```

```tsx
// 3. Pass buildings to ColonyCanvas
      <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Загрузка колонии...</div>}>
        <ColonyCanvas buildings={buildings} />
      </Suspense>
```

- [ ] **Step 2: Update page.tsx to pass buildings to ColonyScreen**

```tsx
// Find where ColonyScreen is rendered in src/app/page.tsx
        case 'colony':
          return (
            <ColonyScreen
              colony={colony}
              colonyLoading={colonyLoading}
              colonyId={colonyId!}
              buildings={buildings} // Add this line
              resources={resources}
              resourcesLoading={resourcesLoading}
              onLogout={logout}
            >
```

- [ ] **Step 3: Run TypeScript checks**

Run: `npx tsc --noEmit`
Expected: No errors related to `ColonyCanvas` or `ColonyScreen` props.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/ColonyScreen.tsx src/app/page.tsx
git commit -m "feat(colony): pass buildings data from page down to PixiJS canvas"
```

# Phase 2: Building Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable interactivity on the PixiJS canvas so players can tap on isometric buildings to view details and perform actions (like demolishing).

**Architecture:** We will bridge PixiJS events to React state. `SpriteFactory` will make its `Graphics` objects interactive using `eventMode="static"` and emit a pointer event. `ColonyScreen` will catch this event and render a standard React Modal over the canvas to handle the user's action (e.g., calling `demolishBuilding`).

**Tech Stack:** React, PixiJS v8 (`@pixi/react`).

---

### Task 1: Create Building Action Modal

**Files:**
- Create: `src/components/game/BuildingActionModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
import { memo, useState } from 'react'
import type { BuildingRow } from '@/domains/building/building.types'
import { ConfirmModal } from '@/components/ui/modal'

interface BuildingActionModalProps {
  building: BuildingRow | null
  onClose: () => void
  onDemolish: (id: string) => Promise<void>
}

export const BuildingActionModal = memo(function BuildingActionModal({ building, onClose, onDemolish }: BuildingActionModalProps) {
  const [confirmDemolish, setConfirmDemolish] = useState(false)

  if (!building) return null

  const handleDemolish = async () => {
    await onDemolish(building.id)
    setConfirmDemolish(false)
    onClose()
  }

  // Base Modal Overlay
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700 shadow-2xl relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>
          
          <h2 className="text-2xl font-bold text-white mb-1">{building.name}</h2>
          <p className="text-gray-400 text-sm mb-6">Уровень {building.level} • {building.is_active ? 'Активно' : 'Неактивно'}</p>
          
          <div className="space-y-3">
            <button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium disabled:opacity-50"
              disabled // Upgrade not implemented yet
            >
              Улучшить (Скоро)
            </button>
            
            <button 
              onClick={() => setConfirmDemolish(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium"
            >
              Снести
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDemolish}
        onClose={() => setConfirmDemolish(false)}
        onConfirm={handleDemolish}
        title="Снос здания"
        message={`Вы уверены, что хотите снести «${building.name}»? Производство будет отменено.`}
        confirmText="Снести"
        danger
      />
    </>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/game/BuildingActionModal.tsx
git commit -m "feat(colony): create action modal for buildings"
```

### Task 2: Make PixiJS Sprites Interactive

**Files:**
- Modify: `src/components/colony/sprites/sprite-factory.tsx`
- Modify: `src/components/screens/ColonyCanvas.tsx`

- [ ] **Step 1: Update SpriteFactory props and objects**

Add `onBuildingClick: (building: BuildingRow) => void` to `SpriteFactoryProps`.
Update the `<pixiGraphics>` element inside `renderedBuildings` to be interactive:

```tsx
// Inside SpriteFactory.tsx renderedBuildings loop return:
      return (
        <pixiGraphics
          key={building.id}
          x={pos.x}
          y={pos.y}
          zIndex={zIndex}
          draw={drawPlaceholder}
          eventMode="static"
          cursor="pointer"
          onpointerdown={() => onBuildingClick(building)}
        />
      )
```

- [ ] **Step 2: Update ColonyCanvas to pass the prop through**

Update `ColonyCanvas` to accept `onBuildingClick: (building: BuildingRow) => void` and pass it to `<SpriteFactory>`.

```tsx
// In ColonyCanvas.tsx
export default function ColonyCanvas({ 
  buildings, 
  onBuildingClick 
}: { 
  buildings: BuildingRow[]
  onBuildingClick: (building: BuildingRow) => void 
}) {
  // ...
  // Later in render:
          <SpriteFactory buildings={buildings} onBuildingClick={onBuildingClick} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/colony/sprites/sprite-factory.tsx src/components/screens/ColonyCanvas.tsx
git commit -m "feat(colony): make isometric buildings interactive with pointer events"
```

### Task 3: Plumb State and Actions in React

**Files:**
- Modify: `src/components/screens/ColonyScreen.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update ColonyScreen to handle selection**

Import `BuildingActionModal`. Add `onDemolish` to `ColonyScreenProps`.
Add local state: `const [selectedBuilding, setSelectedBuilding] = useState<BuildingRow | null>(null)`

Pass `onBuildingClick={setSelectedBuilding}` to `ColonyCanvas`.
Render `<BuildingActionModal building={selectedBuilding} onClose={() => setSelectedBuilding(null)} onDemolish={onDemolish} />` outside the Suspense boundary.

- [ ] **Step 2: Update page.tsx to pass onDemolish**

In `src/app/page.tsx`, find the `case 'colony':` block for TWA.
Pass `onDemolish={handleDemolish}` to `ColonyScreen`.

- [ ] **Step 3: Run TypeScript checks**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/ColonyScreen.tsx src/app/page.tsx
git commit -m "feat(colony): bridge PixiJS clicks to React UI for building interaction"
```

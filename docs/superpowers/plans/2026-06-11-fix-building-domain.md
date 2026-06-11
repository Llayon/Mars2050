# Fix Building Domain Types, Schema, and Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical issues in the building domain by removing duplicate types, making coordinates mandatory in schema and DTO, and ensuring the service correctly saves all building data.

**Architecture:** Surgical edits to domain files to ensure data integrity and type safety across the building lifecycle.

**Tech Stack:** TypeScript, Zod, Supabase

---

### Task 1: Fix Building Types

**Files:**
- Modify: `src/domains/building/building.types.ts`

- [ ] **Step 1: Update imports and remove duplicate ResourceTypeKey**

```typescript
import type { ResourceTypeKey } from '@/domains/resource/resource.types'

/** Represents a building type definition with cost and production rates. */
export interface BuildingType {
// ...
```

- [ ] **Step 2: Update BuildingCreateDTO to make x and y mandatory**

```typescript
/** DTO for creating a new building. */
export interface BuildingCreateDTO {
  colonyId: string
  type: BuildingTypeKey
  name: string
  x: number
  y: number
  group_id?: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/building/building.types.ts
git commit -m "fix(building): remove duplicate ResourceTypeKey and update BuildingCreateDTO"
```

---

### Task 2: Update Building Schemas

**Files:**
- Modify: `src/domains/building/building.schemas.ts`

- [ ] **Step 1: Update buildingCreateSchema**

Change `x` and `y` to be mandatory (remove `.optional()`).
Change `group_id` to be a simple string (remove `.uuid()`).

```typescript
/** Schema for creating a building. */
export const buildingCreateSchema = z.object({
  colonyId: z.string().uuid('Invalid colony ID'),
  type: z.enum([
    'solar_panels',
    'oxygen_generator',
    'water_extractor',
    'mine',
    'greenhouse',
    'research_lab'
  ], { message: 'Invalid building type' }),
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  x: z.number().int(),
  y: z.number().int(),
  group_id: z.string().optional(),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/building/building.schemas.ts
git commit -m "fix(building): make x and y mandatory in schema and simplify group_id"
```

---

### Task 3: Update Building Service

**Files:**
- Modify: `src/domains/building/building.service.ts`

- [ ] **Step 1: Update createBuilding to include x, y, and group_id**

```typescript
  // 3. Create building record
  const { data: building, error } = await supabase
    .from('buildings')
    .insert({
      colony_id: dto.colonyId,
      type: dto.type,
      name: dto.name,
      level: 1,
      is_active: true,
      x: dto.x,
      y: dto.y,
      group_id: dto.group_id
    })
    .select()
    .single()
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/building/building.service.ts
git commit -m "fix(building): include coordinates and group_id in createBuilding"
```

---

### Task 4: Verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run tests if any relevant ones exist**

Run: `npm test src/__tests__/building.service.test.ts` (if exists, checking first)

# Real-Time Resource Ticker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make resource amounts increment/decrement visually in real-time (as integers) based on their production rates without spamming the backend database.

**Architecture:** We will modify the `useResources` hook to maintain a local `displayResources` state. A `useEffect` with `setInterval` will run every second, calculating the fractional resource gain based on `(production - consumption) / 3600`. It accumulates these fractions internally but only updates the visible integer component. Periodic server synchronization remains via the existing Supabase channel and SWR revalidation.

**Tech Stack:** React (Hooks), SWR.

---

### Task 1: Implement Local Ticker in `useResources`

**Files:**
- Modify: `src/hooks/useResources.ts`

- [ ] **Step 1: Write the implementation**

Update `useResources.ts` to manage internal fractional state and expose rounded integer state.

```typescript
import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useSubscription } from './useSubscription'
import type { ResourceRow } from '@/domains/resource/resource.types'

export function useResources(colonyId: string | null) {
  // 1. Fetch initial/authoritative data from server
  const { data: serverResources, mutate, error, isLoading } = useSWR<ResourceRow[]>(
    colonyId ? `/api/resources?colonyId=${colonyId}` : null,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch resources')
      const json = await res.json()
      return json.resources
    },
    { refreshInterval: 60000 } // Sync every minute
  )

  // 2. Local state for smooth UI ticking
  const [displayResources, setDisplayResources] = useState<ResourceRow[]>([])
  
  // We need to track the exact fractional amounts to avoid rounding errors over time
  const exactAmountsRef = useRef<Record<string, number>>({})

  // 3. Sync local state when server data changes (initial load or DB mutation)
  useEffect(() => {
    if (serverResources) {
      setDisplayResources(serverResources)
      // Reset the exact tracking to match server truth
      const newExact: Record<string, number> = {}
      serverResources.forEach(r => {
        newExact[r.type] = r.amount
      })
      exactAmountsRef.current = newExact
    }
  }, [serverResources])

  // 4. The Real-time Visual Ticker
  useEffect(() => {
    if (!serverResources || serverResources.length === 0) return

    const tickInterval = 1000 // 1 second

    const timer = setInterval(() => {
      setDisplayResources(prev => {
        let hasChanges = false
        const next = prev.map(r => {
          const netRatePerHour = r.production_rate - r.consumption_rate
          if (netRatePerHour === 0) return r

          // Rate per second
          const ratePerSec = netRatePerHour / 3600
          
          // Add to exact fractional amount
          exactAmountsRef.current[r.type] = (exactAmountsRef.current[r.type] || r.amount) + ratePerSec
          
          // The UI only shows the floored integer.
          // We use Math.floor to ensure it doesn't round up prematurely.
          const newDisplayAmount = Math.floor(exactAmountsRef.current[r.type])

          if (newDisplayAmount !== Math.floor(r.amount)) {
            hasChanges = true
            return { ...r, amount: newDisplayAmount }
          }
          return r
        })

        return hasChanges ? next : prev
      })
    }, tickInterval)

    return () => clearInterval(timer)
  }, [serverResources])

  // 5. Supabase Realtime fallback (for cross-tab sync or backend events)
  useSubscription('resources', colonyId, () => {
    mutate()
  })

  // Ensure initial display values are also floored integers so they don't start fractional
  const flooredDisplayResources = displayResources.map(r => ({
    ...r,
    amount: Math.floor(r.amount)
  }))

  return {
    resources: flooredDisplayResources,
    loading: isLoading,
    error,
    mutate
  }
}
```

- [ ] **Step 2: Check formatting and imports**

Run: `npm run lint` and `npx tsc --noEmit`. Ensure no exhaustive-deps warnings break the build limits script.
*Note: In the implementation above, `colonyId` might need to be added to the `useSubscription` dependency array if the linter complains.*

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useResources.ts
git commit -m "feat(resources): implement local visual ticker for real-time resource generation"
```

### Task 2: Fix format display in UI (Optional formatting)

**Files:**
- Modify: `src/components/game/ResourcePanel.tsx`
- Modify: `src/components/screens/ResourcesBar.tsx`

Since the hook now floors the `amount`, we want to ensure the UI doesn't accidentally try to format it with decimals if it was doing so previously.

- [ ] **Step 1: Check UI components**
Inspect `src/components/game/ResourcePanel.tsx`. If it uses `.toFixed(1)` or similar, remove it. If it just renders `r.amount`, no change is strictly necessary, but using `Math.floor()` in the hook guarantees integers. We will ensure formatting uses commas for thousands.

```typescript
// Inside ResourcePanel.tsx, ensure display is like:
{r.amount.toLocaleString('ru-RU')}
```
*(If already using a formatter, this task is just verification).*

- [ ] **Step 2: Commit (if changes made)**
```bash
git add src/components/game/ResourcePanel.tsx src/components/screens/ResourcesBar.tsx
git commit -m "style(resources): format integers with locale strings"
```

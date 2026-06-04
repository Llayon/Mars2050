---
id: 012
title: Server Components vs Client Components — Clear Criteria for 'use client'
status: accepted
date: 2026-06-04
tags: [architecture, components, react, nextjs, performance]
affects: [app/**/*.tsx, components/**/*.tsx, hooks/*.ts, AGENTS.md, check-limits.ts]
---

# Decision: 'use client' Only When Required — Clear Criteria for Client vs Server Components

## Context
В Next.js 16 (App Router) каждый файл по умолчанию — **Server Component**. Директива `'use client'` включает Client Component.

Разработчики (включая LLM) часто ошибаются:
- ✅ Ставят `'use client'` везде — «на всякий случай» (Anti-pattern: теряет преимущества Server Components)
- ❌ Не ставят `'use client'` там, где нужны hooks, event handlers или browser APIs (Runtime error)
- ❌ Путают: «данные с сервера» и «код на сервере» — ставят `'use client'` для data fetching (не нужно — hooks сами маркируются)

## Rationale
Чёткие критерии решают:

1. **Производительность** — Server Components рендерятся на сервере, не отправляют JS bundle клиенту
2. **Безопасность** — server-only код (API keys, секреты) остаётся на сервере
3. **Предсказуемость** — LLM-агент знает точное правило без гадания
4. **check-limits** — новый RULE может проверять корректность `'use client'`

## Decision

### MUST use `'use client'` если файл содержит:

| # | Что | Примеры |
|---|-----|---------|
| 1 | **React hooks** | `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useContext`, `useReducer` |
| 2 | **Event handlers** | `onClick`, `onChange`, `onSubmit`, `onKeyDown`, `onMouseEnter` |
| 3 | **Browser APIs** | `window`, `document`, `localStorage`, `navigator`, `fetch` (в component), `setInterval` |
| 4 | **React Context** | `createContext`, `useContext`, `<Context.Provider>` |
| 5 | **Form elements** | `<input>`, `<textarea>`, `<select>` с onChange |
| 6 | **Refs** | `useRef` для DOM nodes |
| 7 | **Custom hooks** | Любой hook, который сам использует `useState`/`useEffect`/etc. |

### MUST NOT use `'use client'` если файл только:

| # | Что | Примеры |
|---|-----|---------|
| 1 | **Рендерит данные** | `<div>{data.name}</div>` — если данные приходят через props |
| 2 | **Типы и интерфейсы** | `export interface Props { ... }` |
| 3 | **Pure functions** | `function formatDate(d: Date) { ... }` |
| 4 | **Конфиги** | `export const SITE_NAME = 'Mars2050'` |
| 5 | **Server-only логика** | API routes, `generateMetadata`, `generateStaticParams` |
| 6 | **Data fetching через async** | Server Component с `await fetch()` |
| 7 | **Zod схемы** | `export const schema = z.object(...)` |

### Особые случаи:

**1. Хуки с 'use client' уже есть — компонент может не ставить**

Если компонент использует hook из `@/hooks/useX`, но сам не использует React hooks напрямую:
```typescript
// ❌ Не нужно — hook сам маркирован 'use client', компонент наследует границу
'use client'
import { useEvents } from '@/hooks/useEvents'
export function EventsPanel() { ... }
```

**Но всё равно ставим** — для явности и чтобы импорт из Server Component не сломался (Server Component не может импортировать Client Component транзитивно).

**Правило**: Лучше явный `'use client'` на границе, чем полагаться на неявное наследование.

**2. layout.tsx — почти всегда Server Component**

Если layout использует hooks (например, `useAuth`), выноси логику в отдельный Client Component:
```typescript
// layout.tsx — Server Component ✅
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>
}
```

**3. Context Provider — обязательно 'use client'**

```typescript
'use client'
export function AuthProvider({ children }) {
  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>
}
```

## Good Example

```typescript
// ✅ Server Component — только рендер данных
// page.tsx (server component by default)
import { ResourcePanel } from '@/components/game/ResourcePanel'

export default async function HomePage() {
  // data fetching на сервере
  const data = await fetchApi()
  return <ResourcePanel data={data} />
}
```

```typescript
// ✅ Client Component — только когда нужна интерактивность
'use client'

import { useState } from 'react'

export function AuthModal({ open, onClose }) {
  const [email, setEmail] = useState('')  // нужен 'use client'

  return (
    <form onSubmit={...}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <button onClick={onClose}>Закрыть</button>
    </form>
  )
}
```

```typescript
// ✅ Custom hook — обязательно 'use client'
'use client'

import { useState, useEffect } from 'react'

export function useResources(colonyId: string | null) {
  const [resources, setResources] = useState([])
  // ...
}
```

## Bad Example

```typescript
// ❌ 'use client' для data fetching — потеря Server Component
'use client'
import { useEffect, useState } from 'react'

export function ResourceList() {
  const [data, setData] = useState([])
  useEffect(() => {
    fetch('/api/resources').then(r => r.json()).then(setData)
  }, [])
  // ...рендер
}
```
✅ Вместо: Server Component + custom hook:
```typescript
// Серверный компонент + useResources hook (который уже 'use client')
import { useResources } from '@/hooks/useResources'
```

```typescript
// ❌ 'use client' на всём подряд — потеря производительности
'use client'
export function formatNumber(n: number) { return n.toLocaleString() }

'use client'
export const COLORS = { red: '#ff0000', green: '#00ff00' }
```
✅ Вместо: только pure функции/константы без 'use client'.

```typescript
// ❌ Нет 'use client' там, где нужен — runtime error
export function Counter() {
  const [count, setCount] = useState(0)  // ❌ 'use client' missing!
  return <button onClick={() => setCount(c + 1)}>{count}</button>
}
```

## Consequences

### Positive
- ✅ Меньше JS bundle — Server Components не отправляют код клиенту
- ✅ Безопаснее — server-only код изолирован
- ✅ LLM знает точные критерии — не гадает
- ✅ layout.tsx остаётся Server Component (чистый HTML/metadata)

### Negative
- ⚠️ Надо помнить 7 критериев (но таблица в ADR под рукой)
- ⚠️ Иногда client boundary всплывает выше, чем ожидаешь (ребёнок client → родитель тоже client)
- ⚠️ Server Components не могут использовать React hooks, даже если hook просто читает state

## Related ADRs
- ADR-001: Domain-Based Architecture (структура модулей)
- ADR-006: File Size Limits (компоненты ≤ 250 строк)
- ADR-011: Component Composition Pattern (page orchestrator)

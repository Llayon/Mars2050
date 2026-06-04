---
id: 011
title: Component Composition Pattern for Pages
status: accepted
date: 2026-06-04
tags: [architecture, pages, components, composition]
affects: [app/**/page.tsx, app/**/layout.tsx, check-limits.ts, architecture.md, AGENTS.md]
---

# Decision: Pages Are Pure Orchestrators — Hooks Only, No Raw JSX >10 Lines

## Context
`page.tsx` — единственная точка входа для UI. Разработчики (включая LLM-агентов) начинали писать логику прямо в page.tsx:

- `fetch()` / `supabase.from()` прямо в page
- 50+ строк JSX в page
- Бизнес-логика в колбэках внутри page
- Импорт сервисов напрямую

Это приводило к сложно-поддерживаемым страницам, где page.tsx разрастался до 200+ строк и становился god component.

## Rationale
Строгая композиционная модель решает:

1. **Page ≤ 150 строк** — легко читать, легко поддерживать
2. **LLM-friendly** — agent видит только hooks + компоненты, не нужно читать реализацию
3. **Тестируемость** — каждый Panel тестируется отдельно
4. **Переиспользование** — Panel можно переставить в другой page/layout
5. **check-limits гарантирует** — ARCH + PAGE + SIZE rules проверяют на CI

## Decision

### 1. Page содержит ТОЛЬКО:
- `'use client'` (если нужна интерактивность)
- Импорты hooks + компонентов
- Hooks в начале функции
- useCallback для колбэков (мемоизация)
- Условный рендеринг (loading / auth check / game)
- Компоненты без пропсов или с минимальными пропсами от hooks

### 2. В page ЗАПРЕЩЕНО:
- `fetch()` — используй hook
- `supabase.from()` — используй hook (RLS read) или API route (write)
- Импорт `@/lib/supabase` — используй hook
- Импорт `domains/*/service` — используй hook
- Inline JSX блок длиннее 10 строк — вынеси в компонент
- Бизнес-логика любого рода — вынеси в service

### 3. Каждый JSX блок >10 строк — отдельный компонент в `components/game/`

Компоненты должны:
- Быть обёрнуты в `React.memo` (если не зависят от children)
- Принимать данные через props (не вызывать hooks внутри, если данные приходят снаружи)
- Исключение: Panel может вызывать свой hook, если данные используются только внутри неё

### 4. Все колбэки — useCallback в page, передаются в компоненты по имени

### 5. Состояние UI (модалки, табы) — в page, не в компонентах

## Good Example

```typescript
// page.tsx — 100 lines, only hooks + components
'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useResources } from '@/hooks/useResources'
import { AuthModal } from '@/components/game/AuthModal'
import { ResourcePanel } from '@/components/game/ResourcePanel'

function GameUI() {
  const { user, colonyId, login, logout } = useAuth()
  const { resources } = useResources(colonyId)
  const [authOpen, setAuthOpen] = useState(false)

  const handleLogin = useCallback((e: string, p: string) => login(e, p), [login])

  if (!user) {
    return (
      <div>
        <button onClick={() => setAuthOpen(true)}>Войти</button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSubmit={handleLogin} />
      </div>
    )
  }

  return (
    <div>
      <header>
        <span>{user.email}</span>
        <button onClick={logout}>Выйти</button>
      </header>
      <ResourcePanel resources={resources} />
    </div>
  )
}
```

## Bad Example

```typescript
// ❌ page.tsx — god component, 200+ lines
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

function GameUI() {
  const [resources, setResources] = useState([])
  const [user, setUser] = useState(null)

  // ❌ бизнес-логика и DB в page
  useEffect(() => {
    supabase.from('resources').select('*').then(({ data }) => setResources(data))
  }, [])

  // ❌ JSX > 10 строк в page
  return (
    <div className="bg-gray-900 text-white p-4">
      <h1>Ресурсы</h1>
      <div className="grid grid-cols-3 gap-2">
        {resources.map(r => (
          <div key={r.id} className="bg-gray-800 p-3 rounded">
            <span>{r.type}: {r.amount}</span>
            <span>Production: {r.production_rate}</span>
            <span>Consumption: {r.consumption_rate}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Consequences

### Positive
- ✅ Page всегда ≤ 150 строк (проверяется SIZE rule)
- ✅ LLM-агент пишет правильный код — ему очевидна структура
- ✅ Каждый Panel — независимый модуль с одной ответственностью
- ✅ Легко рефакторить — page не содержит реализации
- ✅ PAGE rule в check-limits ловит нарушения на CI

### Negative
- ⚠️ Требуется больше файлов на одну страницу (но каждый меньше)
- ⚠️ Нужно прокидывать колбэки через props (но useCallback решает)
- ⚠️ Привыкнуть к «страница без логики» первое время необычно

## Related ADRs
- ADR-001: Domain-Based Architecture (структура доменов)
- ADR-006: File Size Limits (page ≤ 150 строк)
- ADR-007: Surgical Edits Only (не перезаписывать page целиком)

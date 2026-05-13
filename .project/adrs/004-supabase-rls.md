---
id: 004
title: Supabase RLS Pattern
status: accepted
date: 2026-05-07
tags: [supabase, security, rls, database]
affects: [architecture.md, hooks/*.ts, src/app/api/**/route.ts]
---

# Decision: Supabase RLS Pattern

## Context
Данные пользователей (колонии, ресурсы, здания) должны быть изолированы. Один пользователь не должен видеть данные другого.

## Rationale (Критично для ИИ)
**ПОЧЕМУ RLS и только определенные паттерны?**

1. **Безопасность на уровне БД**: RLS (Row Level Security) — последний рубеж защиты
2. **Двухслойная защита**:
   - Хуки читают через `supabase` (anon key) → RLS фильтрует по `auth.uid()`
   - API роуты пишут через `service_role` → но проверяют права в коде
3. **ИИ может захотеть "упростить"**:
   - ❌ Чтение напрямую через `service_role` в хуках — ОПАСНО, обходит RLS
   - ❌ `supabase.auth.admin()` в клиенте — ОПАСНО, admin key не должен быть в браузере
4. **Альтернативы отвергнуты**:
   - ❌ "Проверять права только в коде" — ошибки кода = утечка данных
   - ❌ "Отключить RLS для simplicity" — критическая уязвимость

## Decision
- **Чтение данных**: Только через хуки с `supabase` клиентом (anon key) → RLS работает
- **Запись данных**: Только через API роуты с `service_role` → проверка прав в сервисе
- **В хуках**: Никаких `service_role` ключей
- **В клиенте**: Никаких запросов к БД напрямую (только через хуки → API)

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Хук читает через RLS
// src/hooks/useResources.ts
import { supabase } from '@/lib/supabase' // anon key client

export function useResources(colonyId: string) {
  const [resources, setResources] = useState()

  useEffect(() => {
    // RLS автоматически фильтрует по auth.uid()
    supabase
      .from('resources')
      .select('*')
      .eq('colony_id', colonyId)
      .then(({ data }) => setResources(data))
  }, [colonyId])

  return { resources }
}
```

```typescript
// ✅ ПРАВИЛЬНО: API роут пишет через service_role с проверкой прав
// src/app/api/resources/route.ts
import { getServerClient } from '@/domains/resource/resource.server'

export async function POST(request: Request) {
  const serverClient = getServerClient() // service_role

  // Проверяем права перед записью
  const { data: colony } = await serverClient
    .from('colonies')
    .select('id')
    .eq('id', colonyId)
    .eq('user_id', session.user.id) // Проверка: колония принадлежит юзеру
    .single()

  if (!colony) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Запись
  await serverClient.from('resources').update(...).eq('colony_id', colonyId)
}
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может захотеть читать через service_role в хуке
// src/hooks/useResources.ts
import { getServerClient } from '@/domains/resource/resource.server' // ОПАСНО!

export function useResources(colonyId: string) {
  // ПЛОХО: service_role обходит RLS, читает ВСЕ данные
  const serverClient = getServerClient()

  useEffect(() => {
    serverClient // ОПАСНО: ключ в браузере + нет RLS
      .from('resources')
      .select('*')
      .then(...)
  }, [])
}
```

```typescript
// ❌ НЕПРАВИЛЬНО: Прямой запрос к БД из компонента
// src/components/game/ResourcePanel.tsx
'use client'
import { supabase } from '@/lib/supabase'

export function ResourcePanel() {
  // ПЛОХО: компонент делает запрос напрямую
  const [data, setData] = useState()
  useEffect(() => {
    supabase.from('resources').select('*').then(...) // ПЛОХО!
  }, [])
}
```

## Consequences
### Positive
- ✅ Безопасность: RLS защищает данные на уровне БД
- ✅ Изоляция: пользователи видят только свои данные
- ✅ Масштабируемость: RLS работает независимо от кода

### Negative
- ⚠️ Сложнее писать запросы (нужно учитывать RLS)
- ⚠️ Нужно поддерживать политики RLS в актуальном состоянии

## Related ADRs
- ADR-005: Service Role Key Security (service_role только на сервере)
- ADR-001: Domain-Based Architecture (хуки в hooks/, сервисы в domains/)

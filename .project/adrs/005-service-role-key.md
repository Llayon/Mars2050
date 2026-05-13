---
id: 005
title: Service Role Key Security
status: accepted
date: 2026-05-07
tags: [supabase, security, env, secrets]
affects: [architecture.md, *.server.ts, .env*]
---

# Decision: Service Role Key Security

## Context
Supabase `service_role` key имеет полный доступ к БД (обходит RLS). Если этот ключ попадет в клиентский код, безопасность проекта скомпрометирована.

## Rationale (Критично для ИИ)
**ПОЧЕМУ ключ только на сервере и как его защищать?**

1. **service_role = полный доступ**: Этот ключ может читать/писать любые данные, удалять таблицы
2. **Клиент НИКОГДА не должен видеть этот ключ**:
   - ❌ `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — ОПАСНО, попадает в браузер
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` (без NEXT_PUBLIC_) — только на сервере
3. **ИИ может случайно**:
   - Добавить `NEXT_PUBLIC_` перед ключом "для удобства"
   - Создать клиент с `service_role` в `lib/supabase.ts` (клиентский файл)
   - Вывести ключ в логи или ошибки
4. **Альтернативы отвергнуты**:
   - ❌ "Использовать service_role везде" — убивает RLS, опасно
   - ❌ "Хранить ключ в localStorage" — критическая уязвимость

## Decision
- `SUPABASE_SERVICE_ROLE_KEY` используется ТОЛЬКО в файлах `*.server.ts`
- `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` — безопасны для клиента
- `service_role` клиент создается только через `getServerClient()` в серверных файлах
- Никаких `NEXT_PUBLIC_` префиксов для service_role ключа

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Серверный клиент изолирован
// src/domains/resource/resource.server.ts
import { createClient } from '@supabase/supabase-js'

export function getServerClient() {
  // Только server-side переменные (без NEXT_PUBLIC_)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL! // OK, публичный
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // OK, только на сервере

  return createClient(supabaseUrl, serviceRoleKey)
}

// ✅ ПРАВИЛЬНО: Клиентский файл использует только anon key
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Безопасно для клиента
)
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может добавить NEXT_PUBLIC_ "чтобы работало в браузере"
// .env (ОПАСНО!)
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ... // ПЛОХО! Попадает в бандл

// ❌ НЕПРАВИЛЬНО: Создание service_role клиента в клиентском файле
// src/lib/supabase.ts (ПЛОХО! Это клиентский файл)
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ПЛОХО: ключ в браузере!
)
```

```typescript
// ❌ НЕПРАВИЛЬНО: Логирование ключа (ИИ может добавить для дебага)
console.log('Service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY) // ПЛОХО!
throw new Error(`Invalid key: ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) // ПЛОХО!
```

## Consequences
### Positive
- ✅ Безопасность: `service_role` ключ никогда не попадает в браузер
- ✅ RLS сохраняет смысл: обход RLS только на сервере с проверкой прав
- ✅ Четкое разделение: клиент = anon, сервер = service_role

### Negative
- ⚠️ Нельзя использовать `service_role` для чтения в хуках (только API роуты)
- ⚠️ Нужно следить за именами переменных окружения

## Related ADRs
- ADR-004: Supabase RLS Pattern (service_role обходит RLS)
- ADR-001: Domain-Based Architecture (server файлы в domains/)

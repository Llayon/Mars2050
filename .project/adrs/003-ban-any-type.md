---
id: 003
title: Ban `any` Type
status: accepted
date: 2026-05-07
tags: [typescript, security, types]
affects: [architecture.md, *.ts, check-limits.ts]
---

# Decision: Ban `any` Type

## Context
TypeScript проекты часто скатываются в использование `any` для "быстрого фикса". Это убивает type safety и дает ложное чувство безопасности.

## Rationale (Критично для ИИ)
**ПОЧЕМУ запрещаем `any`?**

1. **TypeScript теряет смысл**: `any` отключает проверки типов, превращая TS в "JavaScript с подсветкой"
2. **Скрытые баги**: `any` пропускает ошибки, которые проявятся только в рантайме
3. **ИИ часто использует `any`**: когда "не знает, как типизировать" или "хочет быстро исправить ошибку"
   - ❌ `(data as any).field` — ИИ может сделать, чтобы "прошло"
   - ✅ `Record<string, unknown>` или конкретный интерфейс — правильно
4. **Безопасность**: `any` может скрывать утечку секретов или неправильную обработку данных
5. **Исключения (где `any` допустимо)**:
   - `SupabaseClient<any>` — особенность типизации Supabase
   - `catch (error)` — в TypeScript catch всегда any
   - `*.config.ts` — когда типы не нужны (редко)
   - `*.server.ts` — иногда нужно для Supabase клиента

## Decision
- Использование `any` типов ЗАПРЕЩЕНО (кроме исключений)
- `as any` приведения ЗАПРЕЩЕНЫ (кроме исключений)
- `: any` аннотации ЗАПРЕЩЕНЫ (кроме исключений)
- Вместо `any` использовать:
  - `unknown` + type guards
  - `Record<string, T>` для динамических ключей
  - Конкретные интерфейсы
  - Generics

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Используем Record вместо any
// src/domains/building/building.utils.ts
function calculateProduction(
  buildings: Building[],
  field: string
): number {
  return buildings.reduce((acc, building) => {
    // ПЛОХО: (building as any)[field] — запрещено!
    // ХОРОШО:
    const config = BUILDING_TYPES[building.type]
    return acc + ((config.production as Record<string, number>)[field] ?? 0)
  }, 0)
}

// ✅ ПРАВИЛЬНО: unknown + type guard
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    // Теперь data имеет правильный тип
  }
}
```

```typescript
// ✅ ПРАВИЛЬНО: Исключение для Supabase (разрешено)
// src/domains/resource/resource.server.ts
import { createClient } from '@supabase/supabase-js'

export function getServerClient() {
  return createClient<Database>( // Не any!
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может добавить any "чтобы работало"
function getData() {
  const response = await fetch('/api/data')
  const data = await response.json()
  return data as any // ПЛОХО! Теряем типизацию
}

// ❌ НЕПРАВИЛЬНО: any в параметрах
function processBuilding(building: any) { // ПЛОХО!
  // Можем обратиться к несуществующему полю
  console.log(building.nonExistentField)
}

// ❌ НЕПРАВИЛЬНО: Обход TypeScript через any
const user = data as any
user.secretKey // TypeScript не выдаст ошибку, но это опасно!
```

## Consequences
### Positive
- ✅ Type safety: ошибки ловятся на этапе компиляции
- ✅ Поддерживаемость: рефакторинг безопасен
- ✅ Читаемость: типы документируют код
- ✅ Безопасность: меньше шансов пропустить уязвимость

### Negative
- ⚠️ Больше кода на типизацию
- ⚠️ Иногда нужно подумать над правильным типом (но это правильно)

## Related ADRs
- ADR-002: Zod Validation Only (валидация дает правильные типы)
- ADR-006: File Size Limits (проверка any в check-limits.ts)

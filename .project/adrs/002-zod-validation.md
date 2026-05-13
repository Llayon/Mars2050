---
id: 002
title: Zod Validation Only
status: accepted
date: 2026-05-07
tags: [validation, api, security, zod]
affects: [architecture.md, *.schemas.ts, src/app/api/**/route.ts]
---

# Decision: Zod Validation Only

## Context
API роуты получают данные от клиента. Нужна валидация входных данных. Ранее использовали ручные проверки `typeof`, `isNaN()`, что уязвимо и неполно.

## Rationale (Критично для ИИ)
**ПОЧЕМУ только Zod, запрещаем ручную валидацию?**

1. **Безопасность**: Ручная валидация часто пропускает edge cases (например, `typeof null === 'object'`)
2. **Полнота**: Zod проверяет типы, обязательность полей, диапазоны, regex
3. **Документация**: Zod схема — это живая документация API
4. **ИИ часто хочет "оптимизировать"**: `if (!body.colonyId)` быстрее, чем писать схему. НО:
   - ❌ `!body.colonyId` пропустит `0`, `false`, `""`
   - ❌ Не проверит, что `colonyId` — валидный UUID
   - ❌ Не даст type inference в TypeScript
5. **Альтернативы отвергнуты**:
   - ❌ `class-validator` — тяжелый, декораторы не нужны
   - ❌ Ручная валидация — уязвимо, неполно

## Decision
- Все API роуты используют Zod `safeParse()` для валидации входных данных
- Ручная валидация (`typeof`, `isNaN`, `parseInt`) в API роутах ЗАПРЕЩЕНА
- Zod схемы живут в `domains/*/schemas.ts`
- API роуты только импортируют схемы (не определяют inline)

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Zod валидация
// src/domains/building/building.schemas.ts
import { z } from 'zod'

export const buildingCreateSchema = z.object({
  colonyId: z.string().uuid(),
  type: z.enum(['solar_panels', 'mine', 'ice_harvester', 'lab']),
})

// src/app/api/buildings/route.ts
import { buildingCreateSchema } from '@/domains/building/building.schemas'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = buildingCreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // parsed.data имеет правильный тип!
  const { colonyId, type } = parsed.data
}
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может захотеть "упростить" до ручной проверки
export async function POST(request: Request) {
  const body = await request.json()

  // ПЛОХО: неполная валидация
  if (!body.colonyId || typeof body.colonyId !== 'string') {
    return NextResponse.json({ error: 'Bad colonyId' }, { status: 400 })
  }

  if (!body.type || typeof body.type !== 'string') {
    return NextResponse.json({ error: 'Bad type' }, { status: 400 })
  }

  // ПЛОХО: не проверяет, что type — валидное значение enum
  // ПЛОХО: нет type inference, body имеет тип any
}
```

```typescript
// ❌ НЕПРАВИЛЬНО: parseInt/parseFloat без проверки
const energy = parseInt(body.energy)
if (isNaN(energy)) { // ПЛОХО: isNaN дает ложноположительные результаты
  return NextResponse.json({ error: 'Bad energy' }, { status: 400 })
}
```

## Consequences
### Positive
- ✅ Безопасность: валидация полная и надежная
- ✅ TypeScript: автоматический type inference из схем
- ✅ Единообразие: все валидации одним способом
- ✅ Легко менять: схема в одном месте

### Negative
- ⚠️ Немного больше кода (но это цена безопасности)
- ⚠️ Нужно поддерживать схемы в актуальном состоянии

## Related ADRs
- ADR-003: Ban `any` Type (валидация защищает от any)
- ADR-001: Domain-Based Architecture (схемы в доменах)

---
id: 001
title: Domain-Based Architecture
status: accepted
date: 2026-05-07
tags: [architecture, domains, structure]
affects: [architecture.md, building.md, resource.md, map.md, colony.md, combat.md, pvp.md, auth.md]
---

# Decision: Domain-Based Architecture

## Context
Проект растет, код в `src/app/` и `src/components/` смешивает бизнес-логику, UI и данные. Сложно находить нужный код, изменения в одной фиче ломают другие.

## Rationale (Критично для ИИ)
**ПОЧЕМУ доменная структура?**

1. **Изоляция изменений**: Изменения в `building.service.ts` не ломают `resource.service.ts`
2. **AI-friendly**: ИИ-агент читает только 1 домен (100-250 строк), а не весь проект (тысячи строк)
3. **Single Source of Truth**: Все правила фичи в одной папке (`types + schemas + config + service + utils`)
4. **Масштабируемость**: Новые фичи добавляются по шаблону, не размазывая код по проекту
5. **Альтернативы отвергнуты**:
   - ❌ "Flat structure" (`src/services/`, `src/types/`) — файлы мешаются, сложно навигировать
   - ❌ "Feature folders in app/" — смешивает роуты и логику, нарушает разделение ответственности

## Decision
Вся бизнес-логика живет в `src/domains/{feature}/` с фиксированным набором файлов:
- `{feature}.types.ts` — DTOs, типы БД
- `{feature}.schemas.ts` — Zod валидация
- `{feature}.config.ts` — Константы баланса
- `{feature}.service.ts` — Бизнес-логика + DB (≤250 строк)
- `{feature}.utils.ts` — Чистые функции (опционально)

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Домен building изолирован
// src/domains/building/building.service.ts
import { BUILDING_TYPES } from './building.config'
import { buildingCreateSchema } from './building.schemas'
import type { BuildingType } from './building.types'

export async function createBuilding(colonyId: string, type: BuildingType) {
  // Логика только для зданий, не знает о ресурсах или карте
}
```

```typescript
// ✅ ПРАВИЛЬНО: API роут тонкий, импортирует из домена
// src/app/api/buildings/route.ts
import { createBuilding } from '@/domains/building/building.service'
// НЕТ бизнес-логики здесь!
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может захотеть "упростить" и положить всё в одну папку
// src/lib/buildings.ts — плохо, нет изоляции
// src/services/ — плохо, файлы разных фич смешиваются
// src/app/api/buildings/route.ts — плохо, бизнес-логика в роуте
```

```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может захотеть "оптимизировать" и убрать config
// Hardcode в сервисе:
const COST = { minerals: 80 } // Плохо, нет централизации
```

## Consequences
### Positive
- ✅ Изоляция: изменения в building не ломают resource
- ✅ AI-friendly: агент читает только нужный домен
- ✅ Понятная структура: новые фичи по шаблону
- ✅ Легко найти баг: всё в одной папке

### Negative
- ⚠️ Больше файлов (неизбежно для изоляции)
- ⚠️ Нужно соблюдать лимиты строк в каждом файле

## Related ADRs
- ADR-006: File Size Limits (ограничивает размер файлов в доменах)

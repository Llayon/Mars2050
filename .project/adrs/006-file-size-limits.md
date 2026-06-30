---
id: 006
title: File Size Limits
status: accepted
date: 2026-05-07
tags: [architecture, limits, maintenance]
affects: [architecture.md, check-limits.ts, *.ts, *.tsx]
---

# Decision: File Size Limits

## Context
Большие файлы сложно читать, поддерживать и рефакторить. ИИ-агенты теряют контекст при работе с файлами >250 строк.

## Rationale (Критично для ИИ)
**ПОЧЕМУ лимиты строк и как с ними работать?**

1. **ИИ имеет ограничение контекста**: Файл в 500 строк может не поместиться в контекст ИИ
2. **Читаемость**: Маленькие файлы легче понимать и изменять
3. **Single Responsibility**: Лимит заставляет выделять подзадачи в отдельные модули
4. **ИИ может захотеть "объединить"**:
   - ❌ "Зачем 5 файлов, давайте в один!" — потеря контекста, сложность
   - ✅ Соблюдать лимиты и выделять логику в sub-модули
5. **Лимиты по типам файлов**:
   - API routes ≤80 строк (тонкий слой)
   - Services ≤250 строк (бизнес-логика)
   - Components ≤250 строк (UI)
   - Hooks ≤150 строк (узкая ответственность)
   - Replay/render engines ≤320 строк только для `battle-replay-engine.ts` и `*-replay-engine.ts`

## Decision
- Файлы не должны превышать лимиты (проверяется `npm run lint:limits`)
- Исключение 320 строк применяется только к replay/render engine файлам. Вспомогательная
  логика отрисовки всё равно выносится в модули (`battle-replay-units.ts`,
  `battle-replay-overlays.ts`, `battle-replay-motion-vfx.ts`).
- При превышении лимита — рефакторинг:
  - Выделить sub-модули (utils, helpers)
  - Разбить компоненты на подкомпоненты
  - Вынести типы/схемы в отдельные файлы

## Good Example (Самое важное для ИИ)
```typescript
// ✅ ПРАВИЛЬНО: Service <250 строк
// src/domains/building/building.service.ts (200 строк)
import { createBuilding } from './building.create' // Выносим в sub-модуль
import { demolishBuilding } from './building.delete' // Выносим в sub-модуль
import { getBuildings } from './building.read' // Выносим в sub-модуль

// Сервис оркестрирует, подробности в отдельных файлах
```

```typescript
// ✅ ПРАВИЛЬНО: Компонент <250 строк
// src/components/game/BuildingsPanel.tsx (180 строк)
import { BuildingCard } from './BuildingCard' // Подкомпонент
import { BuildForm } from './BuildForm' // Подкомпонент

export function BuildingsPanel() {
  // Только оркестрация, JSX в подкомпонентах
}
```

## Bad Example (Самое важное для ИИ)
```typescript
// ❌ НЕПРАВИЛЬНО: ИИ может захотеть "упростить" и объединить всё в один файл
// src/domains/building.ts (600 строк) — ПЛОХО!
// Типы, схемы, конфиги, сервис, утилиты всё в одном — слишком большой!

// ❌ НЕПРАВИЛЬНО: Компонент слишком большой
// src/components/game/GamePage.tsx (400 строк) — ПЛОХО!
// Весь UI на одной странице, ИИ потеряет контекст
```

```typescript
// ❌ НЕПРАВИЛЬНО: Игнорирование лимитов
// "Лимиты не важны, главное чтобы работало" — ПЛОХО!
// Файл растет, становится неподдерживаемым
```

## Consequences
### Positive
- ✅ Читаемость: файлы легко читать и понимать
- ✅ ИИ-friendly: файлы помещаются в контекст
- ✅ Поддерживаемость: легко находить и исправлять баги
- ✅ Архитектура: соблюдается Single Responsibility

### Negative
- ⚠️ Больше файлов (но это цена читаемости)
- ⚠️ Нужно рефакторить при достижении лимита

## Related ADRs
- ADR-001: Domain-Based Architecture (структура файлов в доменах)
- ADR-007: Surgical Edits Only (правки существующих файлов)

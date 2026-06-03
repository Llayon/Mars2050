---
id: 009
title: Structured JSDoc for LLM-Friendly Service Functions
status: accepted
date: 2026-06-03
tags: [documentation, llm, services]
affects: [domains/**/*.service.ts, domains/**/*.generator.ts, domains/**/*.utils.ts, check-limits.ts, architecture.md]
---

# Decision: Structured JSDoc with @param and @returns

## Context
Функции в сервисах имели JSDoc, но только с описательным текстом:
```typescript
/** Создать новое здание. */
export async function createBuilding(dto: BuildingCreateDTO) { ... }
```

LLM-агент не мог понять без чтения всей функции:
- Какие параметры принимает?
- Что возвращает?
- Какие типы ошибок могут быть?

## Rationale
Structured JSDoc с `@param` и `@returns` решает:
1. **LLM понимает API функции без чтения кода** — экономит контекст
2. **Type-safe документация** — @param описывает role параметра (не только тип)
3. **Авто-проверка** — JSDOC rule гарантирует, что у каждой public функции есть док
4. **IDE поддержка** — подсказки при импорте функции

## Decision
Каждая `export function` в `*.service.ts`, `*.generator.ts`, `*.utils.ts`, `*.events.ts` ОБЯЗАНА иметь JSDoc с:
- Описание функции (1-2 строки)
- `@param` для каждого параметра
- `@returns` с описанием возвращаемого значения

## Good Example
```typescript
/**
 * Deletes a building and reverts its production/consumption effects.
 * @param buildingId - Building ID to delete
 * @param colonyId - Colony ID owning the building
 * @returns Success status or error message
 */
export async function deleteBuilding(
  buildingId: string,
  colonyId: string
): Promise<{ success: boolean; error: string | null }> { ... }
```

## Bad Example
```typescript
// ❌ Описание без @param/@returns
/** Delete building. */
export async function deleteBuilding(buildingId: string, colonyId: string) { ... }

// ❌ Комментарий на русском (JSDoc только английский)
/** Удалить здание. */
export async function deleteBuilding(...) { ... }

// ❌ Нет JSDoc вообще
export async function deleteBuilding(...) { ... }
```

## Consequences
### Positive
- ✅ LLM читает JSDoc вместо всей функции
- ✅ IDE показывает параметры с описанием
- ✅ check-limits гарантирует наличие

### Negative
- ⚠️ Поддерживать JSDoc в актуальном состоянии
- ⚠️ 3-5 строк overhead на каждую функцию

## Related ADRs
- ADR-001: Domain-Based Architecture
- ADR-006: File Size Limits (JSDoc не считается в лимит строк)

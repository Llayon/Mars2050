---
id: 008
title: Barrel Exports for All Domains
status: accepted
date: 2026-06-03
tags: [architecture, domains, imports]
affects: [domains/*/index.ts, check-limits.ts, architecture.md]
---

# Decision: Barrel Exports for Deterministic Imports

## Context
LLM-агенты (и разработчики) импортировали из доменов разными путями:
- `from '@/domains/building/building.service'`
- `from '@/domains/building/building.types'`
- `from '@/domains/building/building.schemas'`

Это создавало LLM-ambiguity: какой файл импортировать? Агент мог угадать неправильно или импортировать файл, которого нет.

## Rationale
Единый barrel export (`index.ts`) для каждого домена решает несколько проблем:
1. **Детерминированный импорт** — LLM всегда пишет `from '@/domains/building'`
2. **Сокращение контекста** — один импорт вместо трёх
3. **Авто-документация** — index.ts показывает всё public API домена
4. **Backward compatibility** — если файл переименован, barrel export можно обновить без изменения импортов

## Decision
Каждый домен (папка в `src/domains/`) ОБЯЗАН иметь `index.ts`, который ре-экспортирует все public файлы домена.

## Good Example
```typescript
// domains/building/index.ts
export type * from './building.types'
export * from './building.schemas'
export * from './building.config'
export * from './building.service'
export * from './building.utils'
```

Импорт:
```typescript
import { createBuilding, BUILDING_TYPES, type BuildingRow } from '@/domains/building'
```

## Bad Example
```typescript
// ❌ LLM угадывает путь
import { createBuilding } from '@/domains/building/building.service'
import type { BuildingRow } from '@/domains/building/building.types'

// ❌ Разные стили импорта для одного домена
import { BUILDING_TYPES } from './building.config'
import { createBuilding } from './building.service'
```

## Consequences
### Positive
- ✅ LLM всегда знает, куда импортировать
- ✅ Меньше строк в import секции
- ✅ Public API домена очевидно из одного файла

### Negative
- ⚠️ При добавлении нового файла в домен нужно обновить index.ts (проверяется EXPORT rule)
- ⚠️ `export type *` требует TypeScript 5.0+

## Related ADRs
- ADR-001: Domain-Based Architecture (структура доменов)
- ADR-006: File Size Limits (каждый файл ≤ лимит)

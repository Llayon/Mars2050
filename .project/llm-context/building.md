# Building Domain — Mars2050

## Файлы домена
- `src/domains/building/building.types.ts` — Типы зданий (вкл. workforce, requirements)
- `src/domains/building/building.schemas.ts` — Zod схемы
- `src/domains/building/building.config.ts` — Константы зданий (BUILDING_TYPES)
- `src/domains/building/building.production.ts` — Динамический расчет производства с учетом штата/счастья (getEffectiveProduction)
- `src/domains/building/building.service.ts` — Бизнес-логика (create, delete, unlock checks)
- `src/domains/building/building.utils.ts` — Утилиты

## API Routes
- `src/app/api/buildings/route.ts` — Тонкий роут (валидация → сервис → ответ)

## Hooks
- `src/hooks/useBuildings.ts` — Хук для работы со зданиями

## Components
- `src/components/screens/BuildingsScreen.tsx` — TWA UI панель зданий с отображением штата
- `src/components/game/BuildingsPanel.tsx` — Desktop UI панель зданий

## Типы (ключевые)
- `BuildingTypeKey`: Ключи типов зданий
- `BuildingRow`: Инстанс здания в БД
- `BuildingType`: Конфигурация здания (cost, production, consumption, workforce, unlockedByTier, requiresTerrain)

## Сервис (building.service.ts)
- `createBuilding()`: Построить здание (валидация ресурсов, проверка населения, дедукция стоимости, вызов recalculateResources)
- `deleteBuilding()`: Снести здание (вызов recalculateResources)

## Производство (building.production.ts)
- `getEffectiveProduction()`: Расчет эффективного производства и потребления в зависимости от соотношения `pop / jobs` (fillRatio) и счастья.

## Особенности
- **Workforce**: Производственные здания могут требовать рабочих, техников или учёных.
- **Fill Ratio**: Недостаток работников снижает производство и потребление активных зданий.
- **Happiness**: Счастье работников влияет на эффективное производство.
- **Terrain Requirements**: Некоторые здания требуют подходящего terrain в занимаемой зоне или рядом с ней.
- **Unlocks**: Здания могут открываться по tiers населения/колонии.

## Паттерны
- Все мутации через API route → сервис
- Валидация через Zod schemas
- Динамический перерасчет рейтов через `recalculateResources` при любых изменениях (вместо ручного updateResourceRate).
- Лимит: service ≤250 строк

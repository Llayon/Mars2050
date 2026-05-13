# Building Domain — Mars2050

## Файлы домена
- `src/domains/building/building.types.ts` — Типы зданий
- `src/domains/building/building.schemas.ts` — Zod схемы
- `src/domains/building/building.config.ts` — Константы зданий
- `src/domains/building/building.service.ts` — Бизнес-логика
- `src/domains/building/building.utils.ts` — Утилиты

## API Routes
- `src/app/api/buildings/route.ts` — Тонкий роут (валидация → сервис → ответ)

## Hooks
- `src/hooks/useBuildings.ts` — Хук для работы со зданиями

## Components
- `src/components/game/BuildingsPanel.tsx` — UI панель зданий

## Типы (ключевые)
- `BuildingType`: Типы зданий (solar_panels, mine, etc.)
- `Building`: Инстанс здания в колонии
- `BuildingConfig`: Конфигурация здания (cost, production)

## Конфиг (building.config.ts)
```typescript
BUILDING_TYPES = {
  solar_panels: { cost: { minerals: 80, energy: 20 }, production: { energy: 15 } },
  mine: { cost: { minerals: 150, energy: 40 }, production: { minerals: 12 } },
  // ...
}
```

## Сервис (building.service.ts)
- `createBuilding()`: Построить здание (валидация ресурсов, дедукция стоимости, обновление rates)
- `demolishBuilding()`: Снести здание (возврат части ресурсов, обновление rates)
- `getBuildings()`: Получить здания колонии

## Валидация (building.schemas.ts)
- `buildingCreateSchema`: Zod схема для создания здания
- `buildingDemolishSchema`: Zod схема для сноса здания

## Utils (building.utils.ts)
- `calculateBuildingEffect()`: Расчет эффекта здания
- Функции работы с production rates

## Паттерны
- Все мутации через API route → сервис
- Валидация через Zod schemas
- Константы только в config.ts
- Лимит: service ≤250 строк

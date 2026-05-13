# Map Domain — Mars2050

## Файлы домена
- `src/domains/map/map.types.ts` — Типы локаций
- `src/domains/map/map.schemas.ts` — Zod схемы
- `src/domains/map/map.service.ts` — Бизнес-логика
- `src/domains/map/map.config.ts` — Константы карты
- `src/domains/map/map.generator.ts` — Генератор карты

## API Routes
- `src/app/api/map/route.ts` — Тонкий роут карты
- `src/app/api/explore/route.ts` — Тонкий роут исследования

## Hooks
- `src/hooks/useMap.ts` — Хук для работы с картой

## Components
- `src/components/game/GameMapPanel.tsx` — UI панель карты

## Типы (ключевые)
- `MapLocation`: Локация на карте
- `MapLocationType`: Тип локации (resource, danger, etc.)
- `ExplorationResult`: Результат исследования

## Сервис (map.service.ts)
- `getMapLocations()`: Получить локации (через RLS)
- `exploreLocation()`: Исследовать локацию (cost + rewards)
- `generateMap()`: Сгенерировать новую карту

## Генератор (map.generator.ts)
- `generateMapForColony()`: Генерация карты для новой колонии
- Алгоритм: шум Перлина / случайная генерация

## Конфиг (map.config.ts)
- `MAP_SIZE`: Размер карты
- `EXPLORATION_COST`: Стоимость исследования
- `LOCATION_TYPES`: Типы локаций и их награды

## Валидация (map.schemas.ts)
- `exploreSchema`: Zod схема для исследования

## Паттерны
- Исследование: проверка ресурсов → дедукция cost → генерация reward → обновление локации
- Лимит: service ≤250 строк

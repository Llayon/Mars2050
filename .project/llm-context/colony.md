# Colony Domain — Mars2050

## Файлы домена
- `src/domains/colony/colony.types.ts` — Типы колоний
- `src/domains/colony/colony.schemas.ts` — Zod схемы
- `src/domains/colony/colony.service.ts` — Бизнес-логика

## API Routes
- `src/app/api/colonies/route.ts` — Тонкий роут колоний

## Hooks
- `src/hooks/useColony.ts` — Хук для работы с колонией

## Components
- `src/components/game/ColonyPanel.tsx` — UI панель колонии

## Типы (ключевые)
- `Colony`: Колония игрока
- `ColonyCreate`: DTO создания колонии
- `ColonyUpdate`: DTO обновления колонии

## Сервис (colony.service.ts)
- `getColony()`: Получить колонию игрока (через RLS)
- `createColony()`: Создать новую колонию
- `updateColony()`: Обновить параметры колонии

## Особенности
- Колония создается при регистрации игрока
- Каждая колония имеет свои ресурсы, здания, карту
- RLS защищает доступ только к своей колонии

## Валидация (colony.schemas.ts)
- `colonyCreateSchema`: Zod схема создания
- `colonyUpdateSchema`: Zod схема обновления

## Паттерны
- Чтение: хук → Supabase (RLS)
- Запись: API route → сервис → Supabase (service_role)
- Лимит: service ≤250 строк

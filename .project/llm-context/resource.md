# Resource Domain — Mars2050

## Файлы домена
- `src/domains/resource/resource.types.ts` — Типы ресурсов
- `src/domains/resource/resource.schemas.ts` — Zod схемы
- `src/domains/resource/resource.service.ts` — Бизнес-логика
- `src/domains/resource/resource.events.ts` — События ресурсов
- `src/domains/resource/resource.server.ts` — Supabase server client

## API Routes
- `src/app/api/resources/route.ts` — Тонкий роут ресурсов

## Hooks
- `src/hooks/useResources.ts` — Хук для работы с ресурсами

## Components
- `src/components/game/ResourcePanel.tsx` — UI панель ресурсов

## Типы (ключевые)
- `ResourceType`: Типы ресурсов (minerals, energy, etc.)
- `Resource`: Ресурс колонии (в БД)
- `ResourceUpdate`: DTO для обновления ресурсов

## Сервис (resource.service.ts)
- `getResources()`: Получить ресурсы колонии (через RLS)
- `recalculateResources()`: Пересчет ресурсов (lazy calculation)
- `updateResourceRate()`: Обновление production rate при постройке/сносе

## Особенности
- **Lazy recalculation**: Ресурсы пересчитываются при каждом действии
- **RLS reads**: Чтение через хук `useResources()` с Supabase клиентом
- **Server writes**: Мутации только через API routes с service_role

## Валидация (resource.schemas.ts)
- `resourceUpdateSchema`: Zod схема обновления ресурсов

## Паттерны
- Чтение: хук → Supabase (RLS)
- Запись: API route → сервис → Supabase (service_role)
- Лимит: service ≤250 строк

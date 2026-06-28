# Resource Domain — Mars2050

## Файлы домена
- `src/domains/resource/resource.types.ts` — Типы ресурсов
- `src/domains/resource/resource.schemas.ts` — Zod схемы
- `src/domains/resource/resource.service.ts` — Бизнес-логика (вкл. recalculateResources)
- `src/domains/resource/resource.events.ts` — События ресурсов
- `src/domains/resource/resource.server.ts` — Supabase server client

## API Routes
- `src/app/api/resources/route.ts` — Тонкий роут ресурсов

## Hooks
- `src/hooks/useResources.ts` — Хук для работы с ресурсами

## Components
- `src/components/screens/ResourcesBar.tsx` — UI полоса ресурсов в TWA
- `src/components/game/ResourcePanel.tsx` — Desktop UI панель ресурсов

## Типы (ключевые)
- `ResourceTypeKey`: Ключи типов ресурсов (minerals, energy, consumer_goods, etc.)
- `ResourceRow`: Ресурс колонии (в БД)

## Сервис (resource.service.ts)
- `getResources()`: Получить ресурсы колонии
- `recalculateResources()`: Ключевая функция! Вызывает RPC для начисления офлайн-прогресса, затем рассчитывает новые рейты (производство зданий с учетом `fillRatio` штата, потребление населения) и сохраняет их в БД.

## Особенности
- **Lazy recalculation**: Ресурсы пересчитываются при загрузке и при каждом изменении (постройка/снос зданий).
- **Dynamic Rates**: Мы больше не хардкодим `production_rate` инкрементами. Рейт вычисляется на лету на основе актуального штата и зданий.
- **RLS reads**: Чтение через хук `useResources()` с Supabase клиентом
- **Server writes**: Мутации только через API routes с service_role

## Валидация (resource.schemas.ts)
- `resourceUpdateSchema`: Zod схема обновления ресурсов

## Паттерны
- Чтение: хук → Supabase (RLS)
- Запись: API route → сервис → Supabase (service_role)
- Лимит: service ≤250 строк

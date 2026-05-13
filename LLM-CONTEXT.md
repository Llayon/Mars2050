# LLM-Readable Context Index — Mars2050

## Краткое описание проекта
Браузерная онлайн-стратегия по колонизации Марса.
- Стек: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase
- Геймплей: экономика, строительство, исследование карты, PvP, торговля, рейтинг
- Архитектура: клиент → API Routes (server) → Supabase (service_role_key)
- Auth: Supabase Auth (email/password)
- Real-time: Supabase Realtime (планируется)

## Ключевые директории (приоритет — `domains/`)
- `src/domains/`: Вся бизнес-логика по доменам (auth, building, colony, leaderboard, map, pvp, resource)
  - Каждый домен содержит: `types`, `schemas`, `config`, `service`, `utils`
- `src/app/api/`: Тонкие API-роуты (только валидация → сервис → ответ, без бизнес-логики)
- `src/hooks/`: Хуки по доменам (`useAuth`, `useBuildings` и т.д.)
- `src/components/game/`: Игровые UI-компоненты (`ResourcePanel`, `BuildingsPanel` и т.д.)
- `scripts/`: Скрипты проверки архитектуры (`check-limits.ts`)
- `__tests__/`: Юнит-тесты (vitest)

## Критические правила (кратко)
- ❌ Прямые запросы к БД из клиентских компонентов
- ❌ Хардкод `service_role_key` в клиентском коде
- ❌ Использование `any` без крайней необходимости
- ❌ Комментарии на русском в коде (JSDoc — английский, UI — русский)
- ✅ Все мутации только через API Routes (server-side)
- ✅ Валидация входных данных через Zod на сервере
- ✅ Только точечные правки существующих файлов (surgical edits)
- ✅ Лимиты строк на файлы (API routes ≤80, services ≤250, компоненты ≤250)

## Команды для проверки
- `npm run lint:limits`: Проверка архитектуры (запускает `scripts/check-limits.ts`)
- `npm test`: Запуск юнит-тестов (vitest)
- `npm run build`: Сборка проекта

## Текущее состояние
- ✅ Ядро функционала реализовано (авторизация, здания, карта, ресурсы)
- ✅ Supabase Cloud подключен (gkvsnzwvgonfpuespafm.supabase.co)
- ✅ Проверки архитектуры (включая запрет ручной валидации и `as any`)
- ✅ 40 проходящих тестов
- ✅ **Система событий (Events)** реализована
  - 6 типов событий (Surviving Mars)
  - Авто-генерация (5% шанс)
  - EventsPanel в левом сайдбаре
- ⚠️ Нет обновлений в реальном времени (планируется Supabase Realtime)
- ⚠️ Нет системы игровых тиков (lazy recalculation работает)

## Важные файлы
- `AGENTS.md`: Полные правила для LLM
- `supabase-schema.sql`: Схема БД (дублировать в `src/types/database.ts`)
- `src/domains/*/.config.ts`: Константы баланса игры
- `src/domains/*/.schemas.ts`: Zod-схемы валидации
- `scripts/check-limits.ts`: Скрипт проверки лимитов и правил

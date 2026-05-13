# PvP Domain — Mars2050

## Файлы домена
- `src/domains/pvp/pvp.types.ts` — Типы PvP
- `src/domains/pvp/pvp.schemas.ts` — Zod схемы
- `src/domains/pvp/pvp.service.ts` — Бизнес-логика

## API Routes
- `src/app/api/pvp/attack/route.ts` — Тонкий роут атаки
- `src/app/api/pvp/trade/route.ts` — Тонкий роут торговли

## Hooks
- `src/hooks/usePvp.ts` — Хук для PvP действий

## Components
- `src/components/game/PvpPanel.tsx` — UI панель PvP

## Типы (ключевые)
- `Attack`: Атака на колонию
- `Trade`: Торговая сделка
- `BattleResult`: Результат битвы

## Сервис (pvp.service.ts)
- `attackColony()`: Атаковать колонию (расчет сил, потери)
- `tradeWithColony()`: Торговля ресурсами
- `getBattleLog()`: История битв

## Особенности
- PvP между колониями игроков
- Расчет силы атаки зависит от зданий и ресурсов
- Торговля с комиссией

## Валидация (pvp.schemas.ts)
- `attackSchema`: Zod схема атаки
- `tradeSchema`: Zod схема торговли

## Паттерны
- Валидация целей атаки через RLS
- Начисление наград/потерь через транзакции
- Лимит: service ≤250 строк

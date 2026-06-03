# Architecture Rules — Mars2050

## Critical Rules

### NEVER do this:
- ❌ Прямые запросы к БД из клиентских компонентов
- ❌ Хардкод `service_role_key` в клиентском коде
- ❌ Отключение RLS на продакшене
- ❌ Использование `any` без крайней необходимости
- ❌ Комментарии на русском в коде (JSDoc — английский, UI — русский)
- ❌ Перезапись всего файла — только surgical edits
- ❌ Файлы длиннее лимита (см. ниже)

### ALWAYS do this:
- ✅ Все мутации данных — только через API Routes (server-side)
- ✅ Чтение данных — через Supabase клиент (RLS защищает)
- ✅ Валидация входящих данных через zod-схемы на сервере
- ✅ Типы БД генерируются из `supabase-schema.sql`
- ✅ Новые файлы — по доменной структуре
- ✅ Редактирование — только через surgical replace
- ✅ Ошибки API — только через `apiError()` / `apiValidationError()` / `apiInternalError()` из `@/lib/api-error`
- ✅ Подсказки для LLM — читать `.opencode/instructions/` для конкретной задачи

## File Size Limits

| Type | Max lines | Reason |
|------|-----------|--------|
| API routes | 80 | Thin layer |
| Types / schemas / config | 100 | Compact DTOs |
| Services | 250 | Business logic |
| React components | 250 | JSX cohesive |
| Hooks | 150 | Narrow responsibility |

## Architecture Patterns

### Domain Structure
```
domains/{feature}/
  {feature}.types.ts      — DTOs, row types
  {feature}.schemas.ts    — Zod validation
  {feature}.config.ts     — Game balance
  {feature}.service.ts    — Business logic + DB
  {feature}.utils.ts      — Pure helpers
```

### Code Placement
| Code | Where | Never in |
|------|-------|----------|
| Business logic | `domains/*/service.ts` | page, component, hook |
| DB queries | `domains/*/service.ts` | page, component, hook, route |
| Zod validation | `domains/*/schemas.ts` | route (import only) |
| Game constants | `domains/*/config.ts` | hardcoded in component |
| `fetch('/api/...')` | `hooks/use*.ts` | page (use hook) |
| `supabase.from()` read | `hooks/use*.ts` (RLS) | page, component (use hook) |
| `supabase.from()` write | NEVER client-side | always via API route |

## Error Helper
All API routes use structured errors from `@/lib/api-error`:
- `apiError(code, message, detail?)` — generic error
- `apiValidationError(detail)` — 422 with validation details
- `apiInternalError(err)` — 500 with message from Error
- Format: `{ error: { code, message, detail? } }`

## Lint Commands
- `npm run lint:limits`: Architecture checks (check-limits.ts, 13 rules)
- `npm test`: Unit tests (vitest)
- `npm run build`: Project build
- `/lint:llm` (opencode command): Run with --json for LLM parsing

## Git Hooks
- Pre-commit (husky + lint-staged): check-limits on staged files + vitest on tests

## Rule Emojis
- `🚫 MANUAL`: Ручная валидация в API routes (typeof, isNaN, parseInt)
- `⚠️ ANY`: Использование `any` типов (кроме исключений)
- `📏 SIZE`: Превышение лимита строк
- `📁 DOMAIN`: Нарушение структуры доменов
- `🔒 RLS`: Нарушение правил безопасности
- `🔄 VALIDATE`: Отсутствие Zod валидации
- `🆘 ERROR_HELPER`: Отсутствие apiError импорта
- `🔗 IMPORT_RULES`: Нарушение правил импортов

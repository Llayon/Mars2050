# Architectural Decision Records — Mars2050

Индекс ADR для ИИ-агентов. Читай нужный ADR перед изменениями в соответствующей области.

## Как читать
1. Найди ADR по тегам или затронутым файлам
2. Прочти **Rationale** — почему так решено
3. Изучи **Good Example** / **Bad Example** — как делать (и как НЕ делать)
4. Соблюдай **Status** (accepted = не менять без нового ADR)

## Список ADRs

| ID | Title | Status | Tags | Affects |
|----|-------|--------|------|---------|
| 001 | Domain-Based Architecture | accepted | architecture, domains | architecture.md, all domains |
| 002 | Zod Validation Only | accepted | validation, api, security | architecture.md, *.schemas.ts |
| 003 | Ban `any` Type | accepted | typescript, security | architecture.md, *.ts |
| 004 | Supabase RLS Pattern | accepted | supabase, security, rls | architecture.md, hooks/ |
| 005 | Service Role Key Security | accepted | supabase, security, env | architecture.md, *.server.ts |
| 006 | File Size Limits | accepted | architecture, limits | architecture.md, check-limits.ts |
| 007 | Surgical Edits Only | accepted | workflow, git | AGENTS.md |

## Быстрый поиск по тегам
- `architecture`: 001, 006, 007
- `security`: 002, 003, 004, 005
- `domains`: 001
- `validation`: 002
- `typescript`: 003
- `supabase`: 004, 005
- `api`: 002
- `limits`: 006

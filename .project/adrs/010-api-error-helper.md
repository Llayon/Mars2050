---
id: 010
title: Structured API Error Helper for LLM-Friendly Responses
status: accepted
date: 2026-06-03
tags: [api, errors, llm]
affects: [src/lib/api-error.ts, src/app/api/**/route.ts, check-limits.ts, architecture.md]
---

# Decision: Structured API Error Helper

## Context
Каждый API route обрабатывал ошибки по-своему:
```typescript
// route A
return NextResponse.json({ error: err.message }, { status: 500 })

// route B
return NextResponse.json({ error: String(err) }, { status: 500 })

// route C
return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
```

LLM не мог парсить ошибки единообразно. Разные форматы, статусы, уровни детализации.

## Rationale
Единый error helper решает:
1. **LLM-парсинг** — все ошибки имеют формат `{ error: { code, message, detail? } }`
2. **HTTP статусы из кода** — `BAD_REQUEST` → 400, `NOT_FOUND` → 404
3. **Validation детали** — `apiValidationError` возвращает flatten ошибки Zod
4. **Безопасность** — `apiInternalError` вытаскивает `.message` из Error, не отдаёт stack trace

## Decision
Все API routes используют:
- `apiError(code, message, detail?)` — для бизнес-ошибок
- `apiValidationError(detail)` — для Zod validation errors
- `apiInternalError(err)` — для catch-блоков

Формат ответа: `{ error: { code: string, message: string, detail?: unknown } }`

## Good Example
```typescript
import { apiError, apiValidationError, apiInternalError } from '@/lib/api-error'

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const result = await doSomething(parsed.data)
    if (result.error) return apiError('BAD_REQUEST', result.error)

    return NextResponse.json(result)
  } catch (err) {
    return apiInternalError(err)
  }
}
```

## Bad Example
```typescript
// ❌ Inline error без структуры
return NextResponse.json({ error: 'something wrong' }, { status: 400 })

// ❌ Разные форматы в разных routes
return NextResponse.json({ error: err.message }, { status: 500 })
return NextResponse.json({ error: String(err) }, { status: 500 })

// ❌ try/catch без логирования
catch (err) { return NextResponse.json({ error: 'Unknown' }, { status: 500 }) }
```

## Consequences
### Positive
- ✅ LLM парсит ошибки единообразно
- ✅ Меньше boilerplate в route
- ✅ ERROR_HELPER rule проверяет использование

### Negative
- ⚠️ Дополнительный import в каждом route
- ⚠️ Нужно знать коды ошибок (BAD_REQUEST, NOT_FOUND, VALIDATION_ERROR, INTERNAL_ERROR)

## Related ADRs
- ADR-002: Zod Validation Only (apiValidationError использует результат safeParse)
- ADR-005: Service Role Key Security (ошибки не содержат ключей)

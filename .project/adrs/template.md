---
id: XXX
title: Short Decision Title
status: proposed | accepted | deprecated | superseded
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
affects: [file1.ts, file2.ts, architecture.md]
supersedes: YYY  # only if status is "superseded"
---

# Decision: <Short Decision Title>

## Context
Описание ситуации, требующей решения. Почему текущее состояние не работает?

## Rationale (Критично для ИИ)
**ПОЧЕМУ мы выбрали это решение?**

ИИ склонен "оптимизировать" нестандартные решения, если не понимает их причину.
Опиши:
- Какие альтернативы рассматривали
- Почему альтернативы отвергнуты
- Какие риски закрывает это решение
- Почему это важно для безопасности/масштабируемости/поддержки

## Decision
Что именно мы решили делать?

## Good Example (Самое важное для ИИ)
```typescript
// ПРАВИЛЬНО: покажи, как нужно делать
```

## Bad Example (Самое важное для ИИ)
```typescript
// НЕПРАВИЛЬНО: покажи, что ИИ может захотеть сделать,
// но делать ЗАПРЕЩЕНО и почему
```

## Consequences
### Positive
- ✅ Что стало лучше

### Negative
- ⚠️ Какие компромиссы приняли

## Related ADRs
- ADR-XXX: Связанное решение

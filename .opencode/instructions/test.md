## Test Writing Guidelines

### Pattern
Tests are in `src/__tests__/` using Vitest. Follow existing patterns:

- `building.config.test.ts` — config consistency
- `building.utils.test.ts` — pure utility functions
- `map.generator.test.ts` — generator with deterministic seed
- `schemas.test.ts` — Zod schema validation
- `config.consistency.test.ts` — cross-config integrity

### Structure
```typescript
import { describe, it, expect } from 'vitest'

describe('feature / scenario', () => {
  it('should handle expected case', () => {
    // Arrange
    // Act
    // Assert
  })

  it('should handle edge case', () => {
    // ...
  })
})
```

### What to Test
- Complex business logic in `.service.ts`
- Pure functions in `.utils.ts`
- Config consistency (all types present, no missing keys)
- Zod schemas (valid input passes, invalid input fails)
- Edge cases: empty/missing data, boundary values

### Never
- Don't test implementation details (private functions)
- Don't test Supabase directly (mock if needed)
- Don't write E2E tests in unit test files (use Playwright if configured)

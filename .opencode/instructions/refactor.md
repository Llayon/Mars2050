## Refactoring Guidelines

### Before
1. Run `npm run lint:limits --json` — understand current violations
2. Read the relevant ADR from `.project/adrs/`
3. Read the domain's llm-context from `.project/llm-context/`

### During
- Extract logic: route → service, component → hook, inline → util
- Extract types: move inline types to `.types.ts`
- Extract config: move magic numbers/strings to `.config.ts`
- Split files that exceed size limits
- Use surgical edits only — never rewrite entire files

### After
- Run `npm run lint:limits` — zero new violations
- Run `npm t` — all tests pass
- Run `npx tsc --noEmit` — clean typecheck
- Update `.project/llm-context/` if domain structure changed

### File Splitting Rules
If a file exceeds its limit, extract in this order:
1. Types → existing `.types.ts`
2. Config → `.config.ts`
3. Pure functions → `.utils.ts`
4. Business logic → sibling service files

## Bug Fix Protocol

### Diagnose
1. Reproduce or read error logs (check `console.error` patterns)
2. Find the root cause in the domain service (not in the route)
3. Check if Zod validation catches the bad input

### Fix
1. Apply surgical edit — smallest change possible
2. If it's a validation issue: fix the Zod schema in `.schemas.ts`
3. If it's a logic issue: fix the `.service.ts`
4. If it's a display issue: fix the component or hook

### Verify
- Run `npm t` — existing tests must pass
- Run `npm run lint:limits` — no new violations
- Run `npx tsc --noEmit` — no type errors

### Never
- Don't disable RLS or bypass service_role security
- Don't add `any` types
- Don't rewrite entire files

## New Feature Implementation

### Workflow
1. **Domain first**: create/update `domains/{feature}/{feature}.types.ts` → `.schemas.ts` → `.config.ts` → `.service.ts`
2. **API route**: `app/api/{feature}/route.ts` — thin: validate → service → response
3. **Hook**: `hooks/use{Feature}.ts` — wraps API call + state
4. **Component**: `components/game/{Feature}Panel.tsx` — pure UI
5. **Page**: wire hook + component into `page.tsx` (no logic in page)

### Validation Rules
- Use Zod `safeParse()` on every API input
- No manual validation (`typeof`, `isNaN`, `parseInt`)
- Business logic only in `.service.ts`, never in route or component

### File Size Limits
| Type | Max lines |
|------|-----------|
| API routes | 80 |
| Types / schemas / config | 100 |
| Services | 250 |
| React components | 250 |
| Hooks | 150 |

### Always
- Read relevant ADR from `.project/adrs/` first
- Check `.project/llm-context/` for domain context
- Use surgical edits (replace), never rewrite whole files
- Run `npm run lint:limits` after completion

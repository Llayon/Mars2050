# Mars2050 — AI Agent Rules

## Project Overview

**Mars2050** — браузерная онлайн-стратегия по колонизации Марса.
- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase
- **Gameplay**: экономика, строительство, исследование карты, PvP, торговля, рейтинг
- **Architecture**: клиент → API Routes (server) → Supabase (service_role_key)
- **Auth**: Supabase Auth (email/password)
- **Real-time**: Supabase Realtime (подписки на изменения)

## Verified Stack Versions (Prevent Hallucinations)

> ⚠️ LLM: Read this section before making any changes. This prevents hallucinations about old library versions.

| Library | Current Version | What NOT to use (hallucinations) |
|---------|-----------------|-------------------------------|
| Next.js | 16.2.4 (App Router) | ❌ Next.js ≤15, Pages Router (`pages/`) |
| React | 19.2.4 | ❌ React ≤18, `class` components |
| TypeScript | 5.x | ❌ TypeScript 4.x outdated types |
| Tailwind CSS | 4.x | ❌ Tailwind 3.x syntax (`@tailwind` directives) |
| Supabase JS | 2.105.1 | ❌ Supabase v1, `supabase.auth.api` methods |
| Zod | 4.4.2 | ❌ Zod 3.x syntax (`z.string().nonempty()` instead of `z.string().min(1)`) |
| Vitest | 4.1.5 | ❌ Jest, Mocha |

### Prohibited Patterns (Outdated)

#### Next.js
- ❌ `pages/api/` (legacy) → ✅ `app/api/**/route.ts` (App Router)
- ❌ `getServerSideProps`, `getStaticProps` → ✅ Server Components by default
- ❌ `next/head` → ✅ `metadata` export in `layout.tsx`/`page.tsx`
- ❌ `useRouter` from `next/router` → ✅ `useRouter` from `next/navigation`

#### Supabase
- ❌ `supabase.auth.api.signIn` (v1) → ✅ `supabase.auth.signInWithPassword()` (v2)
- ❌ Direct queries from client → ✅ Only via hooks (RLS) + API routes (service_role)

#### React
- ❌ `useEffect` for data fetching → ✅ Custom hooks (`useResources`, etc.)
- ❌ `document.getElementById` → ✅ `useRef`
- ❌ Global variables for state → ✅ `useState`/`useReducer`

#### TypeScript
- ❌ `enum` keyword → ✅ `z.enum()` or `as const`
- ❌ `as any` → ✅ `Record<string, T>` / `unknown` + type guards
- ❌ Manual validation → ✅ Zod `safeParse()`

### Known LLM Hallucinations (How to Avoid)

| Hallucination | Correct Approach |
|---------------|-------------------|
| "Let's add Pages Router for simplicity" | We use only App Router (Next.js 16) |
| "Zod v3 `z.string().nonempty()`" | Zod v4 uses `z.string().min(1)` |
| "Create `next.config.js`" | We use Next.js 16, config not needed for basic settings |
| "Use `any` to fix type errors" | Use `Record`/`unknown`, see ADR-003 |
| "Disable RLS for debug" | RLS always enabled, see ADR-004 |

> ℹ️ When updating library versions: update this section first, then `package.json`, then code.

## Critical Rules

### NEVER do this:
- ❌ Прямые запросы к БД из клиентских компонентов (компрометирует безопасность)
- ❌ Хардкод секретных ключей (service_role_key) в клиентском коде
- ❌ Отключение RLS на продакшене (только для dev)
- ❌ Использование `any` без крайней необходимости
- ❌ Comment на русском в коде (JSDoc — английский, UI — русский)
- ❌ Перезапись всего файла (write_file), если файл уже существует — только surgical edits (replace)
- ❌ Файлы длиннее лимита для своего типа (см. ниже)

### ALWAYS do this:
- ✅ Все мутации данных — только через API Routes (server-side)
- ✅ Чтение данных — через Supabase клиент (RLS защищает)
- ✅ Валидация входящих данных через zod-схемы на сервере
- ✅ Типы БД генерируются из `supabase-schema.sql`
- ✅ Новые файлы — по доменной структуре (см. ниже)
- ✅ Редактирование существующих файлов — только через surgical replace (точечная замена фрагментов)
- ✅ Каждый файл — одна ответственность, в пределах лимита строк по типу

## Surgical Edit Protocol

When modifying existing files, ALWAYS use surgical edits (replace exact string fragments) instead of rewriting the entire file. This:

1. **Saves context** — smaller diffs mean less token usage
2. **Prevents regressions** — no accidental changes to unrelated code
3. **Preserves unknowns** — code you didn't read stays exactly as-is
4. **Enables review** — changes are easy to spot in git diffs

### Rules:
- **Read first** — always read the file before editing (the tool enforces this)
- **Match exactly** — the `oldString` must match the file content character-for-character
- **Minimal scope** — replace the smallest fragment that achieves the goal
- **Re-read after conflict** — if `edit` fails on "multiple matches", read the file again and provide more context
- **Write only for new files** — `write_file` is for files that don't exist yet

### When a file exceeds its limit:
- Extract logic into separate modules (service, hook, util)
- Split UI into sub-components
- Move types/schemas to their own files in the domain folder

### File size limits by type:

| Type | Max lines | Reason |
|------|-----------|--------|
| API routes | 80 | Thin layer: validate → service → response |
| Types / schemas / config | 100 | DTOs and configs are compact |
| Services | 250 | Business logic, DB queries |
| React components | 250 | JSX is verbose but logically cohesive |
| Hooks | 150 | Narrow responsibility |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages group
│   │   ├── login/
│   │   └── register/
│   ├── (game)/            # Game pages group (protected)
│   │   └── page.tsx       # Main game dashboard — orchestrator only
│   ├── api/               # API Routes (thin: validate → service → response)
│   │   ├── buildings/     # → domains/building
│   │   ├── colonies/      # → domains/colony
│   │   ├── explore/       # → domains/map
│   │   ├── leaderboard/   # → domains/leaderboard
│   │   ├── map/           # → domains/map
│   │   ├── pvp/
│   │   │   ├── attack/    # → domains/pvp
│   │   │   └── trade/     # → domains/pvp
│   │   └── resources/     # → domains/resource
│   └── layout.tsx
├── domains/               # Business logic by domain (PRIMARY location)
│   ├── auth/
│   │   ├── auth.types.ts
│   │   └── auth.service.ts    # Supabase auth wrapper
│   ├── building/
│   │   ├── building.types.ts
│   │   ├── building.schemas.ts
│   │   ├── building.service.ts
│   │   ├── building.config.ts
│   │   └── building.utils.ts
│   ├── colony/
│   │   ├── colony.types.ts
│   │   ├── colony.schemas.ts
│   │   └── colony.service.ts
│   ├── leaderboard/
│   │   ├── leaderboard.types.ts
│   │   └── leaderboard.service.ts
│   ├── map/
│   │   ├── map.types.ts
│   │   ├── map.schemas.ts
│   │   ├── map.service.ts
│   │   ├── map.config.ts
│   │   └── map.generator.ts
│   ├── pvp/
│   │   ├── pvp.types.ts
│   │   ├── pvp.schemas.ts
│   │   └── pvp.service.ts
│   └── resource/
│       ├── resource.types.ts
│       ├── resource.schemas.ts
│       ├── resource.service.ts
│       ├── resource.events.ts
│       └── resource.server.ts    # Shared Supabase server client
├── components/            # Shared UI components
│   ├── ui/               # Primitives (Modal, Toast)
│   └── game/             # Game-specific panels (ResourcePanel, GameMapPanel, BuildingsPanel)
├── hooks/                 # Custom React hooks (one per domain)
│   ├── useAuth.ts
│   ├── useBuildings.ts
│   ├── useMap.ts
│   └── useResources.ts
├── __tests__/              # Unit tests (vitest)
│   ├── building.config.test.ts
│   ├── building.utils.test.ts
│   ├── config.consistency.test.ts
│   ├── map.generator.test.ts
│   └── schemas.test.ts
└── lib/                   # Infrastructure (minimal)
    ├── supabase.ts        # Browser client (anon key only)
    └── game/
        └── constants.ts   # Shared game constants (RESOURCE_NAMES, etc.)
```

### Key principle: domains/ is the single source of truth

When working on a feature, the LLM should find ALL business logic in ONE domain directory:

```
"I need to add a new building type" → src/domains/building/
"I need to change exploration cost" → src/domains/map/
"I need to change resource formula" → src/domains/resource/
```

Each API route is a 1-3 line import from its domain:
```typescript
// app/api/buildings/route.ts
import { createBuilding } from '@/domains/building/building.service'
```

No business logic in routes. No DB queries in hooks. No Supabase in components.

## Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Files | kebab-case | `building-panel.tsx`, `colony.service.ts` |
| Components | PascalCase | `BuildingPanel`, `MarsMap` |
| Hooks | camelCase with use | `useColony`, `useResources` |
| Types/Interfaces | PascalCase | `Colony`, `BuildingType`, `MapLocation` |
| API routes | kebab-case | `/api/buildings`, `/api/pvp/attack` |
| DB tables | snake_case | `map_locations`, `building_types` |
| DB columns | snake_case | `colony_id`, `production_rate` |

## Game Constants

All game balance values live in `*.config.ts` files, NOT in components or API routes.

```typescript
// building.config.ts
export const BUILDING_TYPES = {
  solar_panels: { cost: { minerals: 80, energy: 20 }, production: { energy: 15 }, ... },
  mine: { cost: { minerals: 150, energy: 40 }, production: { minerals: 12 }, ... },
  ...
}
```

## Stack-Specific Patterns (No Re-inventing the Wheel)

When working with this stack, ALWAYS use the built-in patterns and abstractions. Do NOT write custom solutions when the framework provides one.

### Next.js App Router — Built-in Patterns

| Pattern | Use This | Never Do This |
|---------|----------|---------------|
| **API endpoints** | `app/api/{route}/route.ts` | `pages/api/` (legacy) |
| **Server Components** | Default (no `'use client'`) | Mark everything `'use client'` |
| **Client Components** | `'use client'` only for interactivity | Use `'use client'` for data fetching |
| **Loading states** | `loading.tsx` + Suspense | Manual `isLoading` boolean |
| **Error handling** | `error.tsx` + `not-found.tsx` | Manual try/catch in every component |
| **Shared layout** | `layout.tsx` | Duplicate headers/footers |
| **Route params** | `params` prop in Server Components | `useParams()` in Client Components |
| **Meta/SEO** | `metadata` export in page/layout | `<Head>` component |
| **Route handlers** | `export async function GET/POST/DELETE` | Express-style `app.get()` |

### Supabase — Built-in Patterns

| Pattern | Use This | Never Do This |
|---------|----------|---------------|
| **Server client** | `getServerClient()` from `resource.server.ts` | `createClient(url, key)` inline |
| **Browser client** | `supabase` singleton from `lib/supabase.ts` | Create new client per component |
| **Auth** | `supabase.auth.signInWithPassword()` etc. | Custom JWT handling |
| **RLS reads** | `supabase.from('table').select()` in hooks | Disable RLS or bypass policies |
| **Mutations** | API Routes with `service_role_key` | Direct `supabase.from().insert()` from client |
| **Realtime** | `supabase.channel()` + `on()` | Polling with `setInterval` |
| **Storage** | `supabase.storage` | Custom S3 upload logic |

### React — Built-in Patterns

| Pattern | Use This | Never Do This |
|---------|----------|---------------|
| **State** | `useState` / `useReducer` | Global variables, `window` properties |
| **Data fetching** | Custom hooks (`useResources`, `useAuth`) | `fetch()` directly in components |
| **Side effects** | `useEffect` | Manual event listeners without cleanup |
| **Memoization** | `useMemo` / `useCallback` | Premature optimization |
| **Refs** | `useRef` for DOM nodes | `document.getElementById()` |
| **Context** | Only for global state (auth, theme) | Prop drilling alternative for 2-level hierarchy |

### TypeScript — Built-in Patterns

| Pattern | Use This | Never Do This |
|---------|----------|---------------|
| **Validation** | Zod schemas (`*.schemas.ts`) | Manual `if (typeof x === 'string')` |
| **API responses** | `safeParse()` + typed results | `JSON.parse()` without validation |
| **DB types** | Generated from schema | Hand-written interfaces |
| **Enums** | `z.enum([...])` or `as const` | TypeScript `enum` keyword |
| **Error types** | `{ data, error, status }` objects | `throw` for business errors |
| **Generic any** | `SupabaseClient<any>` for table rows | `as any` casts |

### Tailwind — Built-in Patterns

| Pattern | Use This | Never Do This |
|---------|----------|---------------|
| **Styling** | Utility classes | Inline `style={{ ... }}` |
| **Colors** | `bg-gray-800`, `text-green-400` | Hex colors in classes |
| **Spacing** | `p-4`, `gap-2` | Arbitrary pixel values |
| **Responsiveness** | `md:`, `lg:` prefixes | Manual `window.innerWidth` checks |
| **Components** | `@apply` in CSS for repeated patterns | Duplicate 10+ class strings |

### Anti-Pattern Examples

```typescript
// ❌ Polling instead of Supabase Realtime
setInterval(() => fetch('/api/resources'), 5000)

// ✅ Realtime subscription
supabase.channel('resources')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, callback)
  .subscribe()
```

```typescript
// ❌ Manual validation
const body = await request.json()
if (!body.colonyId || typeof body.colonyId !== 'string') {
  return NextResponse.json({ error: 'Bad colonyId' }, { status: 400 })
}

// ✅ Zod validation
const parsed = buildingCreateSchema.safeParse(await request.json())
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
```

```typescript
// ❌ Client Component for data fetching
'use client'
function BadComponent() {
  const [data, setData] = useState()
  useEffect(() => { fetch('/api/data').then(r => r.json()).then(setData) }, [])
}

// ✅ Server Component + hook
function GoodComponent() {
  const { data } = useData()  // hook handles fetch + validation
}
```

## No Raw Logic in Pages (Everything is a Domain Module)

Pages (`page.tsx`, `layout.tsx`) are orchestrators — they compose, never implement.
Every new feature MUST be a self-contained domain module before wiring into a page.

### The Rule:
> If you're about to write business logic, a Supabase query, or an API call
> inside a page component — STOP. Create a domain module first.

### What "Domain Module" means:

Every feature is a complete, self-contained unit with this structure:

```
domains/{feature}/
  {feature}.types.ts      — DTOs, row types (no logic)
  {feature}.schemas.ts    — Zod validation (no logic)
  {feature}.config.ts     — Game balance constants (no logic)
  {feature}.service.ts    — All business logic + DB queries (≤250 lines)
  {feature}.utils.ts      — Pure helper functions (optional)
```

Then expose to UI via:

```
hooks/use{Name}.ts          — React hook wrapping API calls
components/game/{Name}Panel.tsx — UI component receiving props/hook data
app/api/{feature}/route.ts — Thin route: validate → service → response
```

### What goes WHERE:

| Code | Where | Never in |
|------|-------|----------|
| Business logic | `domains/*/service.ts` | page, component, hook |
| DB queries | `domains/*/service.ts` | page, component, hook, route |
| Zod validation | `domains/*/schemas.ts` | route (import only) |
| Game constants | `domains/*/config.ts` | hardcoded in component |
| `fetch('/api/...')` | `hooks/use*.ts` | page (use hook instead) |
| `supabase.from()` read | `hooks/use*.ts` (RLS) | page, component (use hook) |
| `supabase.from()` write | NEVER client-side | always via API route |
| UI composition | `page.tsx` | — |
| UI markup | `components/game/*.tsx` | page (extract to component) |

### Adding a new feature checklist:

1. Create `domains/{feature}/{feature}.types.ts`
2. Create `domains/{feature}/{feature}.schemas.ts`
3. Create `domains/{feature}/{feature}.config.ts` (if game constants)
4. Create `domains/{feature}/{feature}.service.ts`
5. Create `app/api/{feature}/route.ts` (thin: validate → service → response)
6. Create `hooks/use{Feature}.ts`
7. Create `components/game/{Feature}Panel.tsx`
8. Wire into `page.tsx` (hook + component, no logic)

### Page composition pattern:

```typescript
// page.tsx — ONLY hooks, components, state wiring
function GameUI() {
  const { resources, refetch } = useResources(colonyId)  // hook, not fetch
  const { buildings, build } = useBuildings(colonyId)      // hook, not fetch

  return (
    <ResourcePanel resources={resources} />               // component, not inline JSX
    <BuildingsPanel buildings={buildings} onBuild={build} onRefresh={refetch} />
  )
}

// ❌ NEVER in page.tsx:
// - fetch('/api/...')           → use a hook
// - supabase.from('...')       → use a hook (read) or API route (write)
// - business logic             → use a service
// - 50+ lines of JSX           → extract to component
```

DB types are defined in `supabase-schema.sql` and mirrored in `src/types/database.ts`.
When schema changes, update BOTH files.

## LLM-First Development Patterns

### opencode.json (`/opencode.json`)
OpenCode configuration with custom modes, MCP, commands, and permissions:
- **MCP**: Playwright MCP (E2E testing) — enable via `opencode.json`
- **Custom agents**: `architect` (architecture review), `reviewer` (code review)
- **Custom commands**: `/lint:llm`, `/test:llm`, `/build:check`, `/context <domain>`
- **Permission rules**: `git *` and `npm *` allowed, others ask

### Prompt Templates (`.opencode/instructions/`)
Task-specific templates loaded by OpenCode automatically:
| File | Trigger | Purpose |
|------|---------|---------|
| `feature.md` | New features | Domain-first workflow |
| `bugfix.md` | Bug fixing | Diagnose → fix → verify |
| `refactor.md` | Code refactoring | Extract logic, split files |
| `test.md` | Test writing | Given/When/Then pattern |

### LLM Context Files (`.project/llm-context/`)
Domain-specific context files for focused AI reading:
- `architecture.md` — Core rules, file limits, patterns
- `{domain}.md` — One per domain (building, resource, map, colony, pvp, auth, events)

### Architectural Decision Records (`.project/adrs/`)
ADRs with Good/Bad Examples specifically designed for LLM comprehension:
| ADR | Title | Key Insight |
|-----|-------|-------------|
| 001 | Domain-Based Architecture | Business logic in `domains/` only |
| 002 | Zod Validation | Every API input validated via `safeParse` |
| 003 | Ban `any` | Type safety everywhere |
| 004 | Supabase RLS | Reads via hooks (RLS), writes via API (service_role) |
| 005 | Service Role Key Security | Secret key never in client code |
| 006 | File Size Limits | Context window optimization |
| 007 | Surgical Edits | Never rewrite files, only replace fragments |

### API Error Helper (`@/lib/api-error`)
All API routes use structured error responses via `apiError()` / `apiValidationError()` / `apiInternalError()`:
```typescript
// ✅ Structured error for LLM-friendly parsing
return apiError('BAD_REQUEST', 'colonyId is required')
return apiValidationError(parsed.error.flatten())
return apiInternalError(err)
```
Response format: `{ error: { code, message, detail? } }` with HTTP status derived from code.

### Architecture Enforcer (`scripts/check-limits.ts`)
15 automated rules checked on `prebuild` and `pre-commit`:
| Rule | What it checks | Severity |
|------|---------------|----------|
| SIZE | File size limits by type | error |
| NAMING | kebab-case filenames | error |
| SECURITY | No service key in client code | error |
| ARCH | No direct DB mutations from client | error |
| ZOD | POST handlers use zod validation | error |
| MANUAL | No manual typeof/isNaN/parseInt | error |
| ANY | No `: any` or `as any` | warning |
| IDIOM | Services use getServerClient, no throws | warning |
| PAGE | No raw logic in pages | warning |
| PASCAL | Component PascalCase exports | info |
| DOMAIN | Domain directories have required files | warning |
| ERROR_HELPER | API routes use apiError helper | warning |
| IMPORT_RULES | No cross-api imports, hooks don't import services | warning |
| EXPORT | Domains must have index.ts barrel export | info |
| JSDOC | Public functions in services must have JSDoc | info |

Use `--json` for LLM-parsable output, `--diff` for changed files only.

### Git Hooks (husky + lint-staged)
- **Pre-commit**: runs check-limits on staged files + vitest on test files
- Configured in `.husky/pre-commit` and `package.json` → `lint-staged`

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=          # Required. Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Required. Public anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=         # Required. Secret! Server-only, NEVER expose to client
NEXT_PUBLIC_GAME_NAME=Mars2050     # Optional. Game display name
```

## Current State

- ✅ Project initialized (Next.js 16 + TypeScript + Tailwind)
- ⚠️ Supabase Cloud project paused (project: gkvsnzwvgonfpuespafm)
  - URL: https://gkvsnzwvgonfpuespafm.supabase.co — DNS NXDOMAIN (project paused by free-tier inactivity)
  - Fix: restore at https://supabase.com/dashboard/projects or create new project + update .env.local
  - Schema: profiles, colonies, resources, buildings, map_locations, building_types, pending_events, **events**
- ✅ RLS policies configured, service_role_key for mutations
- ✅ Domain structure: building, resource, map, colony, pvp, auth, leaderboard, **events**
- ✅ Zod validation on all mutation endpoints
- ✅ Lazy resource calculation (recalculateResources on every action)
- ✅ Cost deduction on build/explore, rate updates on build/demolish
- ✅ Auth (Supabase email/password) with AuthModal
- ✅ Map exploration with cost + rewards
- ✅ Building construction with cost validation
- ✅ Toast/Modal/ConfirmModal UI (no alert/prompt/confirm)
- ✅ Architecture enforcer script (check-limits.ts) — 15 rules, runs on prebuild + pre-commit
- ✅ Unit tests (vitest) — 40 tests covering config, schemas, generator
- ✅ All API routes use service layer (no direct DB in routes)
- ✅ All API routes use structured apiError helper from `@/lib/api-error`
- ✅ opencode.json with custom agents, MCP, commands, permissions
- ✅ Prompt templates for feature/bugfix/refactor/test in `.opencode/instructions/`
- ✅ Git hooks (husky + lint-staged) — pre-commit check
- ✅ Barrel exports (index.ts) for all 8 domains — deterministic import path
- ✅ Structured JSDoc (@param, @returns) on all exported service functions
- ✅ Type generation from DB schema (`npm run generate:types`)
- ✅ Scaffold generator (`npm run scaffold <name>`)
- ✅ CI/CD workflow (`.github/workflows/ci.yml`)
- ✅ Playwright MCP (enabled for E2E testing)
- ✅ UI components split (page &lt;150 lines, panels separate, page.tsx is 125 lines — no business logic, only hooks + composition)
- ✅ **All 8 domains have full pattern**: types + schemas + config + service + hook + panel + API route
  - auth → useAuth + AuthModal
  - building → useBuildings + BuildingsPanel
  - colony → useColony + ColonyPanel
  - events → useEvents + EventsPanel
  - leaderboard → useLeaderboard + LeaderboardPanel
  - map → useMap + GameMapPanel
  - pvp → usePvp + PvpPanel
  - resource → useResources + ResourcePanel
- ✅ **Events system implemented** (Surviving Mars inspired)
  - 6 event types: dust_storm, meteor_shower, anomaly_discovered, resource_vein, cold_wave, solar_flare
  - Auto-generation (5% chance per resource recalculation)
  - Events affect production rates (modifiers)
  - UI: EventsPanel in sidebar
- ✅ **Health check endpoint** (`/api/health`) — checks env vars + Supabase connectivity
- ✅ **Supabase connectivity check** in `lib/supabase.ts` — warns in browser console if project is paused
- ✅ **Network error UX** — Failed to fetch / DNS errors show readable Russian messages instead of raw TypeError
- ⚠️ No real-time updates yet (Supabase Realtime planned)
# Mars2050 — AI Agent Guide

This file provides foundational context for AI agents working on the Mars2050 project.

## Project Overview
Mars2050 is a browser-based online strategy game about colonizing Mars.
- **Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase.
- **Architecture:** Client → API Routes (Server) → Supabase (using `service_role_key`).
- **Domain-Driven Design:** All business logic is encapsulated within `src/domains/`.

## Critical Architecture Rules
Automated checks are performed by `scripts/check-limits.ts`. Run `npm run lint:limits` to verify.

1. **Domain Isolation:** Each domain in `src/domains/` (e.g., `auth`, `building`, `colony`, `resource`) must contain:
   - `index.ts` (Barrel export)
   - `{name}.service.ts` (Business logic)
   - `{name}.types.ts` (TypeScript types)
   - `{name}.schemas.ts` (Zod validation schemas)
   - `{name}.config.ts` (Constants and game balance)
2. **Surgical Edits:** Only modify the specific code necessary for the task. Avoid large refactors unless explicitly requested.
3. **No Direct DB Mutations:** Client components must NOT use `supabase.from().insert/update/delete()`. All mutations must go through API Routes.
4. **Validation:** All API Route inputs must be validated using Zod schemas. Manual validation (e.g., `typeof x === 'string'`) is prohibited.
5. **File Size Limits:**
   - API Routes: ≤ 80 lines
   - Services: ≤ 250 lines
   - Components: ≤ 250 lines
   - Hooks: ≤ 150 lines
6. **No `any`:** The use of `: any` or `as any` is strictly forbidden except in specific, justified cases (e.g., external library types).
7. **Security:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code (`src/components/`, `src/hooks/`).

## Building and Running
- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm test`: Run unit tests (Vitest).
- `npm run lint:limits`: Check architectural rules and file size limits.
- `npm run generate:types`: Update Supabase types.

## Development Conventions
- **Naming:** Filenames must be `kebab-case.ts/tsx`.
- **Documentation:** Public functions in services, generators, and utils MUST have JSDoc in **English**.
- **UI Language:** User-facing text in the UI should be in **Russian**.
- **Error Handling:** API Routes must use the `apiError` helper from `@/lib/api-error`.
- **Supabase Client:** Use `getServerClient()` in services and `createBrowserClient()` (via hooks) in the client.

## Key Files for Context
- `AGENTS.md`: Full instruction set for LLMs.
- `LLM-CONTEXT.md`: High-level project index.
- `.project/adrs/`: Architectural Decision Records.
- `supabase-schema.sql`: Database schema definition.

Before making changes, always check the relevant ADR in `.project/adrs/` and domain context in `.project/llm-context/`.

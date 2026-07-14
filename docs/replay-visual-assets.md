# Replay Visual Assets

Replay unit visuals are a contract, not a renderer fallback detail. Every
current combat unit must have a direct public runtime asset or an explicit
coverage exemption.

## Source Of Truth

Runtime visual coverage lives in
`src/components/game/battle-replay-visual-registry.ts`.

| Registry field | Purpose |
| --- | --- |
| `REPLAY_VISUAL_ASSETS` | Manifest of unit type to runtime visual asset. |
| `REPLAY_VISUAL_COVERAGE_EXEMPTIONS` | Current units allowed to render without a unit asset. |
| `REPLAY_SPRITE_ALIASES` | Migration escape hatch only; current `UNIT_TYPES` must not use aliases. |
| `REPLAY_SPRITE_DIRECTIONS` | Canonical replay direction order for directional frames. |

Supported asset kinds:

| Kind | Runtime files | Notes |
| --- | --- | --- |
| `png` | One PNG per direction under one public folder. | Expected files are `<path>/<direction>.png`. |
| `svg-strip` | One 8-direction SVG strip in `public/assets/units/`. | Uses deterministic frame indexes from `REPLAY_SPRITE_DIRECTIONS`. |
| `atlas` | Atlas JSON plus matching PNG. | The checker expects the PNG next to the JSON path. |

Runtime assets should live under `public/assets/units/` for new units. Existing
legacy folders under `public/sprites/` remain supported until the source art is
regenerated.

Source or reference art should live outside runtime-only public paths, for
example under `assets/source/`, and the final exported runtime file must still
be registered in `REPLAY_VISUAL_ASSETS`.

## Adding A Unit Visual

1. Add or export the runtime asset files under `public/assets/units/`.
2. Add a `REPLAY_VISUAL_ASSETS` entry for the exact combat `UnitTypeKey`.
3. Use a direct asset for current units. Do not add a current unit to
   `REPLAY_SPRITE_ALIASES`.
4. Add a coverage exemption only for a unit that intentionally has no replay
   body, such as an invisible battlefield object.
5. Add or update a simulator QA preset only when the visual introduces a new
   readability risk.

## Verification

Run the standalone asset contract first:

```bash
npm run replay:visuals
```

For targeted unit-level coverage:

```bash
npx vitest run src/__tests__/battle-replay-sprites.test.ts
```

If renderer behavior changes, also run:

```bash
npm run test:e2e:replay
npm run test:e2e:replay-pixi
npm run test:e2e:replay-baseline
```

Before committing combat replay changes, keep the normal project gates green:

```bash
npx tsc --noEmit --pretty false
npx tsx scripts/check-limits.ts --diff HEAD --json
npm test
npm run build
```

# UI Context — Mars2050

## Main Surfaces
- Desktop uses a canvas-first HUD shell: top resource/population bar, alert stack, bottom action bar, and overlay-based workflows.
- `src/components/game/command-center/` contains the army/PvP Command Center.
- `src/components/game/base-operations/` contains building and production operations.
- Legacy panels may still exist and must not be deleted until their workflows are fully covered by overlays and QA.
- TWA/mobile uses full-screen screens under `src/components/screens/` with a persistent bottom navigation model.

## Rules
- Do not add new dependencies for basic HUD work unless explicitly approved.
- Do not use emoji as the foundation of production UI. Prefer text, CSS markers, and existing icons.
- Keep Pixi/canvas as the primary playfield layer; overlays should not permanently hide the map/colony.
- Keep old workflows mounted during migration if their state would be lost by unmounting.
- Do not move business logic into UI components. Use hooks and domain services.

## Current Migration State
- Command Center covers defense deployment, attack deployment, target UUID/practice target flow, cooldown display, and replay launch.
- Base Operations is replacing legacy building/resource panels.
- A future Global Management overlay should absorb colony profile, events, leaderboard, and logs before `LegacyPanelsDrawer` is removed.


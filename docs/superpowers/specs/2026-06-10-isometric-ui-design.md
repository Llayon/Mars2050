# Design Doc: Isometric UI for Mars2050 (TWA)

## Overview
Transform the current text-based UI of Mars2050 into a visually rich, isometric colony view optimized for Telegram Web Apps (TWA).

## Goals
- **Visual Appeal:** Move from a list-based view to a dynamic isometric map.
- **Performance:** Ensure 60 FPS on mobile devices using PixiJS.
- **Maintainability:** Keep business logic in React/Services while delegating rendering to PixiJS.
- **TWA Optimized:** Responsive HUD using React and Tailwind.

## Architecture: Hybrid Rendering
We will use a **Hybrid Approach**:
- **PixiJS (Canvas):** Renders the isometric ground tiles, buildings, and animations (smoke, rockets).
- **React (DOM/HUD):** Renders the UI overlays (Resource bars, Profile, Build menus).

### Component Structure
1. **`GameScreen` (Container):** Manages the layout and orchestrates data flow between Supabase and the UI.
2. **`ColonyCanvas` (PixiJS):** 
   - Uses `@pixi/react` for integration.
   - Implements `Viewport` for panning and zooming.
   - Renders a `GridLayer` and `BuildingLayer`.
3. **`GameHUD` (React):**
   - **`TopBar`:** Commander profile and resource tickers.
   - **`BuildPanel`:** Horizontal scrollable list of available buildings.
   - **`BottomNav`:** Main navigation buttons.

## Data Changes
The `buildings` table needs to track spatial data:
- `x`: Integer (Grid X coordinate).
- `y`: Integer (Grid Y coordinate).

## Isometric Mechanics
- **Grid Type:** Diamond (Isometric).
- **Tile Size:** 64px width, 32px height (2:1 ratio).
- **Coordinate Conversion:**
  - `screenX = (mapX - mapY) * (TILE_WIDTH / 2)`
  - `screenY = (mapX + mapY) * (TILE_HEIGHT / 2)`
- **Depth Sorting:** Buildings will be rendered in a container where children are sorted by their `y` coordinate (and then `x`) to ensure correct overlap.

## User Interactions
1. **Selection:** Tapping a building on the map opens a React Modal for actions (Upgrade/Demolish).
2. **Construction:**
   - User selects a building from the `BuildPanel`.
   - The map enters `PlacementMode`.
   - A "ghost" sprite follows the cursor/finger.
   - Snaps to the nearest empty grid cell.
   - Tapping "Confirm" triggers the API call.

## Visual Assets (MVP)
- **Background:** High-res texture of Martian soil.
- **Buildings:** Transparent PNG sprites (Solar Panels, Mine, etc.).
- **Feedback:** Highlight tiles (Green for valid, Red for invalid).

## Implementation Phases
- **Phase 1:** Update DB schema and domain types.
- **Phase 2:** Basic PixiJS setup with isometric grid.
- **Phase 3:** Rendering existing buildings on the map.
- **Phase 4:** HUD redesign with Tailwind.
- **Phase 5:** Interactive building placement.

## Future Extensions
- **Animations:** Rocket launches, moving rovers, weather effects (dust storms).
- **Roads/Pipes:** Auto-tiling system to connect buildings.
- **Dynamic Lighting:** Day/night cycle.

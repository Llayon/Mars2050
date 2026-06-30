# Events Domain — Mars2050

## Purpose
Events are colony incidents and modifiers that affect production, operations, and player attention.

## Files
- `src/domains/events/` — event types, schemas, service logic when present.
- `src/components/game/EventsPanel.tsx` — legacy desktop event panel.
- `src/components/screens/OperationsScreen.tsx` — TWA events/PvP surface.

## Current Behavior
- Events are used as colony notifications and production modifiers.
- Events should be presented as gameplay incidents, not plain admin logs.
- Future UI migration should move events into a Global Management / Logs overlay.

## Rules
- Event effects must be deterministic and server-authoritative.
- Do not make client-only event modifiers that change economy or combat outcomes.
- Keep generated test events clearly marked as development/debug actions.


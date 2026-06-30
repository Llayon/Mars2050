# Leaderboard Domain — Mars2050

## Purpose
Leaderboard ranks colonies/players and gives long-term PvP/economy goals.

## Files
- `src/domains/leaderboard/leaderboard.types.ts`
- `src/domains/leaderboard/leaderboard.service.ts`
- `src/components/game/LeaderboardPanel.tsx`
- `src/hooks/useLeaderboard.ts`
- `src/app/api/leaderboard/route.ts`

## Rules
- API route stays thin: validate/request context, call service, return structured response.
- Leaderboard reads should be RLS-safe and should not expose private colony internals.
- UI should treat leaderboard as a management/intel surface, not a permanent canvas-blocking panel.

## UI Direction
- Desktop: move into future Global Management overlay.
- Mobile/TWA: keep under Profile/Intel-style screen with compact ranking rows.


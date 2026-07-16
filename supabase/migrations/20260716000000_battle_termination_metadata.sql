alter table public.battle_snapshots
  add column if not exists termination_reason text
    check (termination_reason in ('elimination', 'mutual_elimination', 'stalemate', 'timeout')),
  add column if not exists elapsed_ticks integer
    check (elapsed_ticks >= 0);


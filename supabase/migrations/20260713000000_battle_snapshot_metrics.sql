-- Store combat QA metrics with replay snapshots so PvP replays can be
-- audited without re-simulating the battle.

alter table public.battle_snapshots
  add column if not exists metrics jsonb;

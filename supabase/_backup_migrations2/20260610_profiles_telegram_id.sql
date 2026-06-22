-- Add telegram_id column to profiles for O(1) Telegram user lookup
-- (replaces admin.listUsers() scan of all auth.users)

ALTER TABLE public.profiles ADD COLUMN telegram_id bigint UNIQUE;

-- Backfill from existing auth.users metadata
UPDATE public.profiles
SET telegram_id = (au.raw_user_meta_data->>'telegram_id')::bigint
FROM auth.users au
WHERE profiles.id = au.id
  AND au.raw_user_meta_data->>'telegram_id' IS NOT NULL;

-- Index for fast lookup by Telegram ID
CREATE INDEX profiles_telegram_id_idx ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;

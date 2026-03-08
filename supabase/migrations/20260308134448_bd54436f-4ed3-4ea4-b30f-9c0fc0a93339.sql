
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_consent boolean NOT NULL DEFAULT false;

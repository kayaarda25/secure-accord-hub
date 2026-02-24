
-- Add last_read_at column to thread_participants for tracking unread messages
ALTER TABLE public.thread_participants
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NULL;

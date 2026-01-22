-- Add Zoom meeting fields to scheduled_meetings table
ALTER TABLE public.scheduled_meetings 
ADD COLUMN IF NOT EXISTS zoom_join_url TEXT,
ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
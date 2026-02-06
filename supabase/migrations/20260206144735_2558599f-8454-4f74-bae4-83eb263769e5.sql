-- Add response_reason column to calendar_event_participants
ALTER TABLE public.calendar_event_participants
ADD COLUMN response_reason text;

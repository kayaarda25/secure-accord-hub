-- Fix infinite recursion in calendar RLS policies
-- The issue is that calendar_events SELECT policy queries calendar_event_participants,
-- which then triggers its own RLS that might query back to calendar_events

-- Create a security definer function to safely check event access
CREATE OR REPLACE FUNCTION public.is_calendar_event_participant(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_event_participants
    WHERE event_id = _event_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_calendar_event_creator(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE id = _event_id AND created_by = _user_id
  );
$$;

-- Drop existing policies on calendar_event_participants
DROP POLICY IF EXISTS "Users can view participants of events they can access" ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creators can manage participants" ON calendar_event_participants;
DROP POLICY IF EXISTS "Users can view event participants" ON calendar_event_participants;

-- Create new policies that don't cause recursion
CREATE POLICY "Users can view event participants"
ON calendar_event_participants FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_calendar_event_creator(event_id, auth.uid())
);

CREATE POLICY "Event creators can add participants"
ON calendar_event_participants FOR INSERT
WITH CHECK (
  is_calendar_event_creator(event_id, auth.uid())
);

CREATE POLICY "Event creators can remove participants"
ON calendar_event_participants FOR DELETE
USING (
  is_calendar_event_creator(event_id, auth.uid())
);

CREATE POLICY "Participants can update own status"
ON calendar_event_participants FOR UPDATE
USING (user_id = auth.uid());

-- Update calendar_events policy to use the function
DROP POLICY IF EXISTS "Users can view own events or shared events" ON calendar_events;

CREATE POLICY "Users can view own events or shared events"
ON calendar_events FOR SELECT
USING (
  created_by = auth.uid() 
  OR is_calendar_event_participant(id, auth.uid())
);
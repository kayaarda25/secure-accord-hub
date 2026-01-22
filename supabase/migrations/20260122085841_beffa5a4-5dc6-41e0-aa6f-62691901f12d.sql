-- Create helper functions to break RLS recursion
CREATE OR REPLACE FUNCTION public.is_meeting_creator(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM scheduled_meetings
    WHERE id = _meeting_id AND created_by = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meeting_participants
    WHERE meeting_id = _meeting_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_meeting_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT meeting_id FROM meeting_participants WHERE user_id = _user_id;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view meetings they created or are invited to" ON scheduled_meetings;
DROP POLICY IF EXISTS "Users can view participants of their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can manage participants" ON meeting_participants;

-- Recreate scheduled_meetings SELECT policy without recursion
CREATE POLICY "Users can view meetings they created or are invited to"
ON scheduled_meetings FOR SELECT
USING (
  created_by = auth.uid() 
  OR public.is_meeting_participant(id, auth.uid())
);

-- Recreate meeting_participants policies without recursion
CREATE POLICY "Users can view participants of their meetings"
ON meeting_participants FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_meeting_creator(meeting_id, auth.uid())
);

CREATE POLICY "Meeting creators can manage participants"
ON meeting_participants FOR INSERT
WITH CHECK (
  public.is_meeting_creator(meeting_id, auth.uid())
);
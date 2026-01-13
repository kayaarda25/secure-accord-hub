-- Fix infinite recursion in profiles RLS policy
-- The problem is that the policy tries to query profiles to check organization_id

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view organization profiles" ON public.profiles;

-- Create a SECURITY DEFINER function to get user's organization_id without RLS
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Recreate the policy using the function instead of subquery
CREATE POLICY "Users can view organization profiles" 
ON public.profiles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  OR user_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

-- Fix the calendar_events policy bug (event_id = calendar_event_participants.id should be calendar_events.id)
DROP POLICY IF EXISTS "Users can view own events or shared events" ON public.calendar_events;

CREATE POLICY "Users can view own events or shared events" 
ON public.calendar_events
FOR SELECT
TO public
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM calendar_event_participants cep
    WHERE cep.event_id = calendar_events.id
    AND cep.user_id = auth.uid()
  )
);

-- Fix scheduled_meetings to avoid recursion with meeting_participants
DROP POLICY IF EXISTS "Users can view meetings they created or are invited to" ON public.scheduled_meetings;

CREATE POLICY "Users can view meetings they created or are invited to" 
ON public.scheduled_meetings
FOR SELECT
TO public
USING (
  created_by = auth.uid()
  OR id IN (
    SELECT meeting_id 
    FROM meeting_participants 
    WHERE user_id = auth.uid()
  )
);
-- Fix infinite recursion in RLS policies between communication_threads <-> thread_participants
-- by using SECURITY DEFINER helper functions (row_security off) and rewriting policies.

BEGIN;

-- 1) Helper functions (bypass RLS internally)
CREATE OR REPLACE FUNCTION public.is_thread_creator(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.communication_threads t
    WHERE t.id = _thread_id
      AND t.created_by = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_thread_participant(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.thread_participants tp
    WHERE tp.thread_id = _thread_id
      AND tp.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_thread(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.communication_threads t
    WHERE t.id = _thread_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR t.created_by = _user_id
        OR t.type = 'internal'::communication_type
        OR (t.type = 'partner'::communication_type AND public.has_any_role(_user_id, ARRAY['management'::app_role, 'partner'::app_role]))
        OR (t.type = 'authority'::communication_type AND public.has_any_role(_user_id, ARRAY['state'::app_role, 'management'::app_role]))
        OR (t.type = 'direct'::communication_type AND public.is_thread_participant(_thread_id, _user_id))
      )
  );
$$;

-- 2) Rewrite policies to avoid cross-table recursion

-- communication_threads
DROP POLICY IF EXISTS "Users can view threads based on type" ON public.communication_threads;
DROP POLICY IF EXISTS "Users can create threads" ON public.communication_threads;
DROP POLICY IF EXISTS "Users can update own threads" ON public.communication_threads;

CREATE POLICY "Users can view accessible threads"
ON public.communication_threads
FOR SELECT
TO authenticated
USING (public.can_access_thread(id, auth.uid()));

CREATE POLICY "Users can create threads"
ON public.communication_threads
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own threads"
ON public.communication_threads
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- thread_participants
DROP POLICY IF EXISTS "Users can view their thread participations" ON public.thread_participants;
DROP POLICY IF EXISTS "Thread creators can add participants" ON public.thread_participants;
DROP POLICY IF EXISTS "Thread creators can remove participants" ON public.thread_participants;

CREATE POLICY "Users can view thread participants"
ON public.thread_participants
FOR SELECT
TO authenticated
USING (
  public.is_thread_participant(thread_id, auth.uid())
  OR public.is_thread_creator(thread_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Thread creators can add participants"
ON public.thread_participants
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND (
    public.is_thread_creator(thread_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Thread creators can remove participants"
ON public.thread_participants
FOR DELETE
TO authenticated
USING (
  public.is_thread_creator(thread_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- communication_messages
DROP POLICY IF EXISTS "Users can view messages in accessible threads" ON public.communication_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.communication_messages;

CREATE POLICY "Users can view messages in accessible threads"
ON public.communication_messages
FOR SELECT
TO authenticated
USING (public.can_access_thread(thread_id, auth.uid()));

CREATE POLICY "Users can send messages"
ON public.communication_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_access_thread(thread_id, auth.uid())
);

COMMIT;

BEGIN;

-- Ensure created_by is always set from the authenticated session
CREATE OR REPLACE FUNCTION public.set_communication_thread_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_communication_thread_created_by ON public.communication_threads;
CREATE TRIGGER trg_set_communication_thread_created_by
BEFORE INSERT ON public.communication_threads
FOR EACH ROW
EXECUTE FUNCTION public.set_communication_thread_created_by();

-- Ensure added_by is always set from the authenticated session
CREATE OR REPLACE FUNCTION public.set_thread_participant_added_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  NEW.added_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_thread_participant_added_by ON public.thread_participants;
CREATE TRIGGER trg_set_thread_participant_added_by
BEFORE INSERT ON public.thread_participants
FOR EACH ROW
EXECUTE FUNCTION public.set_thread_participant_added_by();

-- Relax INSERT checks to avoid client/server mismatch; triggers enforce the columns.
DROP POLICY IF EXISTS "Users can create threads" ON public.communication_threads;
CREATE POLICY "Users can create threads"
ON public.communication_threads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Thread creators can add participants" ON public.thread_participants;
CREATE POLICY "Thread creators can add participants"
ON public.thread_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.is_thread_creator(thread_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

COMMIT;

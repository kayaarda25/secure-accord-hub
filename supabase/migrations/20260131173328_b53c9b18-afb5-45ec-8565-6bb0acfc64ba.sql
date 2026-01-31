-- 1) Allow NULL subject for direct threads, but keep subject required for other types via trigger
ALTER TABLE public.communication_threads
  ALTER COLUMN subject DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_communication_thread_subject()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- For non-direct threads, require a non-empty subject
  IF (NEW.type IS DISTINCT FROM 'direct'::communication_type) THEN
    IF NEW.subject IS NULL OR btrim(NEW.subject) = '' THEN
      RAISE EXCEPTION 'subject is required for non-direct threads';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_communication_thread_subject ON public.communication_threads;
CREATE TRIGGER trg_validate_communication_thread_subject
BEFORE INSERT OR UPDATE ON public.communication_threads
FOR EACH ROW
EXECUTE FUNCTION public.validate_communication_thread_subject();


-- 2) Create participants table (was missing), with RLS
CREATE TABLE IF NOT EXISTS public.thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_id ON public.thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id ON public.thread_participants(user_id);

ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;

-- Read: participant can read own rows; admin can read all; thread creator can read rows for their threads
DROP POLICY IF EXISTS "Users can view their thread participations" ON public.thread_participants;
CREATE POLICY "Users can view their thread participations"
ON public.thread_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.communication_threads t
    WHERE t.id = thread_participants.thread_id
      AND t.created_by = auth.uid()
  )
);

-- Insert: only the thread creator (or admin) can add participants; added_by must be auth.uid()
DROP POLICY IF EXISTS "Thread creators can add participants" ON public.thread_participants;
CREATE POLICY "Thread creators can add participants"
ON public.thread_participants
FOR INSERT
WITH CHECK (
  added_by = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.communication_threads t
      WHERE t.id = thread_participants.thread_id
        AND t.created_by = auth.uid()
    )
  )
);

-- Delete: only the thread creator (or admin) can remove participants
DROP POLICY IF EXISTS "Thread creators can remove participants" ON public.thread_participants;
CREATE POLICY "Thread creators can remove participants"
ON public.thread_participants
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.communication_threads t
    WHERE t.id = thread_participants.thread_id
      AND t.created_by = auth.uid()
  )
);


-- 3) Allow participants to see direct threads (otherwise only creator/admin could see them)
DROP POLICY IF EXISTS "Users can view threads based on type" ON public.communication_threads;
CREATE POLICY "Users can view threads based on type"
ON public.communication_threads
FOR SELECT
USING (
  (type = 'internal'::communication_type)
  OR (created_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR ((type = 'partner'::communication_type) AND has_any_role(auth.uid(), ARRAY['management'::app_role, 'partner'::app_role]))
  OR ((type = 'authority'::communication_type) AND has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]))
  OR (
    (type = 'direct'::communication_type)
    AND EXISTS (
      SELECT 1
      FROM public.thread_participants tp
      WHERE tp.thread_id = communication_threads.id
        AND tp.user_id = auth.uid()
    )
  )
);

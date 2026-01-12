
-- Fix INSERT RLS failures by setting created_by on the server and tightening update checks

-- 1) Ensure created_by is always the authenticated user on INSERT
CREATE OR REPLACE FUNCTION public.set_tasks_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tasks_created_by ON public.tasks;
CREATE TRIGGER set_tasks_created_by
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_tasks_created_by();

-- 2) Recreate tasks INSERT/UPDATE policies with WITH CHECK to prevent tampering
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;

CREATE POLICY "Users can create their own tasks"
ON public.tasks
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own tasks"
ON public.tasks
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

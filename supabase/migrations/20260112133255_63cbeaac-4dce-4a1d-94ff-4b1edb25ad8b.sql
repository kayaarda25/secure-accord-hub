
-- Avoid RLS recursion between tasks <-> task_participants by using SECURITY DEFINER helpers

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND (
        t.created_by = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.task_participants tp
          WHERE tp.task_id = t.id
            AND tp.user_id = _user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_task_creator(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND t.created_by = _user_id
  );
$$;

-- Rebuild TASKS policies
DROP POLICY IF EXISTS "Users can view own tasks or shared tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks or shared tasks"
ON public.tasks
FOR SELECT
USING (public.can_access_task(id, auth.uid()));

CREATE POLICY "Users can create their own tasks"
ON public.tasks
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own tasks"
ON public.tasks
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Users can delete own tasks"
ON public.tasks
FOR DELETE
USING (created_by = auth.uid());

-- Rebuild TASK_PARTICIPANTS policies (remove cross-table queries)
DROP POLICY IF EXISTS "Users can view participants of their tasks" ON public.task_participants;
DROP POLICY IF EXISTS "Task creators can manage participants" ON public.task_participants;
DROP POLICY IF EXISTS "Task creators can delete participants" ON public.task_participants;

CREATE POLICY "Users can view participants of their tasks"
ON public.task_participants
FOR SELECT
USING (public.can_access_task(task_id, auth.uid()));

CREATE POLICY "Task creators can manage participants"
ON public.task_participants
FOR INSERT
WITH CHECK (public.is_task_creator(task_id, auth.uid()));

CREATE POLICY "Task creators can delete participants"
ON public.task_participants
FOR DELETE
USING (public.is_task_creator(task_id, auth.uid()));

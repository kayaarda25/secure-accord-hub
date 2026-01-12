
-- Fix function config syntax and disable RLS within the SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
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
SET search_path TO public
SET row_security TO off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND t.created_by = _user_id
  );
$$;

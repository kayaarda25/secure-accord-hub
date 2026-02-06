
-- Create a security definer function to check project membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- Drop and recreate the projects SELECT policy using the new function
DROP POLICY IF EXISTS "Users can view projects they created or participate in" ON public.projects;

CREATE POLICY "Users can view projects they created or participate in"
ON public.projects
FOR SELECT
USING (
  created_by = auth.uid()
  OR is_project_member(id, auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

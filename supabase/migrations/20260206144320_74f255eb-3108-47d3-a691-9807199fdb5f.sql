-- Fix tasks SELECT policy to avoid potential issues with security definer function during INSERT+SELECT
DROP POLICY IF EXISTS "Users can view own tasks or shared tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks or shared tasks"
ON public.tasks
FOR SELECT
USING (
  created_by = auth.uid()
  OR can_access_task(id, auth.uid())
);

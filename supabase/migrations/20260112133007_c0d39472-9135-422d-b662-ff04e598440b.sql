
-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view own tasks or shared tasks" ON public.tasks;

-- Recreate with correct reference
CREATE POLICY "Users can view own tasks or shared tasks" 
ON public.tasks 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM task_participants 
    WHERE task_participants.task_id = tasks.id 
    AND task_participants.user_id = auth.uid()
  )
);

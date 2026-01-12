-- Drop existing SELECT policy for communication_threads
DROP POLICY IF EXISTS "Users can view threads based on type" ON public.communication_threads;

-- Create new SELECT policy that includes admin role
CREATE POLICY "Users can view threads based on type" 
ON public.communication_threads 
FOR SELECT 
USING (
  (type = 'internal'::communication_type) 
  OR (created_by = auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR ((type = 'partner'::communication_type) AND has_any_role(auth.uid(), ARRAY['management'::app_role, 'partner'::app_role]))
  OR ((type = 'authority'::communication_type) AND has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]))
);
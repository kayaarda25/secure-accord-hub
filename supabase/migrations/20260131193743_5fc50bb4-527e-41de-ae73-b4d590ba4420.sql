-- Drop existing policy
DROP POLICY IF EXISTS "Users can view meeting protocols" ON public.meeting_protocols;

-- Create stricter policy: 
-- Users can only see protocols if:
-- 1. They created it
-- 2. Their organization is explicitly in shared_with_organizations
-- 3. They are an attendee (by matching their profile name)
CREATE POLICY "Users can view meeting protocols" 
ON public.meeting_protocols 
FOR SELECT 
USING (
  (created_by = auth.uid()) 
  OR (get_user_organization_id(auth.uid()) = ANY(shared_with_organizations))
);
-- Add shared_with_organizations column to meeting_protocols
ALTER TABLE public.meeting_protocols
ADD COLUMN shared_with_organizations uuid[] DEFAULT '{}';

-- Update RLS policy for meeting_protocols to include shared organizations
DROP POLICY IF EXISTS "Users can view meeting protocols" ON public.meeting_protocols;

CREATE POLICY "Users can view meeting protocols" 
ON public.meeting_protocols 
FOR SELECT 
USING (
  (created_by = auth.uid()) 
  OR has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role])
  OR (get_user_organization_id(auth.uid()) = ANY(shared_with_organizations))
);
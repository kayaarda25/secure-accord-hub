-- Drop existing view policy
DROP POLICY IF EXISTS "Users can view documents" ON public.documents;

-- Create stricter policy for documents:
-- Users can only see documents if:
-- 1. They uploaded it
-- 2. They are a designated signer
-- 3. Document is explicitly shared with them (user or organization level)
-- 4. Their organization is in shared_with_organizations array
CREATE POLICY "Users can view documents" 
ON public.documents 
FOR SELECT 
USING (
  (uploaded_by = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM document_signatures ds
    WHERE ds.document_id = documents.id AND ds.signer_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM document_shares ds
    WHERE ds.document_id = documents.id 
    AND (
      ds.shared_with_user_id = auth.uid() 
      OR ds.shared_with_organization_id = get_user_organization_id(auth.uid())
    )
  ))
  OR (get_user_organization_id(auth.uid()) = ANY(shared_with_organizations))
);
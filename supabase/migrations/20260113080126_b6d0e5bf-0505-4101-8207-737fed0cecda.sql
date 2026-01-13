-- Fix: Documents Storage Access Control
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view document files" ON storage.objects;

-- Create a more secure policy that checks document-level permissions
CREATE POLICY "Users can view authorized document files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND (
    -- User owns the folder (uploaded the file)
    auth.uid()::text = (storage.foldername(name))[1]
    -- OR user has admin/management/state role
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'state'::app_role])
    -- OR user uploaded the document
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = name
      AND d.uploaded_by = auth.uid()
    )
    -- OR user is a signer for the document
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.document_signatures ds ON ds.document_id = d.id
      WHERE d.file_path = name
      AND ds.signer_id = auth.uid()
    )
    -- OR document was shared with the user
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.document_shares dsh ON dsh.document_id = d.id
      WHERE d.file_path = name
      AND (
        dsh.shared_with_user_id = auth.uid()
        OR dsh.shared_with_organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
      )
    )
  )
);
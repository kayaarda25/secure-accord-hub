-- Add last_modified_by column to documents table for tracking edits
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS last_modified_by uuid;

-- Create document_activity table for SharePoint-like activity feed
CREATE TABLE IF NOT EXISTS public.document_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'created', 'viewed', 'downloaded', 'edited', 'renamed', 'moved', 'shared'
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on document_activity
ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_activity
CREATE POLICY "Users can view activity for accessible documents"
ON public.document_activity
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_activity.document_id
    AND (
      d.uploaded_by = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'state'::app_role])
      OR EXISTS (
        SELECT 1 FROM document_signatures ds
        WHERE ds.document_id = d.id AND ds.signer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM document_shares ds
        WHERE ds.document_id = d.id 
        AND (
          ds.shared_with_user_id = auth.uid() 
          OR ds.shared_with_organization_id = get_user_organization_id(auth.uid())
        )
      )
    )
  )
);

CREATE POLICY "Authenticated users can create activity logs"
ON public.document_activity
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_document_activity_document_id ON public.document_activity(document_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_created_at ON public.document_activity(created_at DESC);
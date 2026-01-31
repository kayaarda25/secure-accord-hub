-- Create table for folder sharing with organizations
CREATE TABLE public.folder_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  shared_with_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(folder_id, shared_with_organization_id)
);

-- Enable RLS
ALTER TABLE public.folder_shares ENABLE ROW LEVEL SECURITY;

-- Policies for folder_shares
CREATE POLICY "Users can view folder shares" 
ON public.folder_shares 
FOR SELECT 
USING (
  shared_with_organization_id = get_user_organization_id(auth.uid())
  OR shared_by = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can create folder shares" 
ON public.folder_shares 
FOR INSERT 
WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Users can delete own folder shares" 
ON public.folder_shares 
FOR DELETE 
USING (shared_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Add is_shared column to document_folders for quick filtering
ALTER TABLE public.document_folders 
ADD COLUMN is_shared BOOLEAN DEFAULT false;

-- Add shared_with_organizations to documents table for upload sharing
ALTER TABLE public.documents
ADD COLUMN shared_with_organizations UUID[] DEFAULT '{}';

-- Update the document_folders RLS policy to include shared folders
DROP POLICY IF EXISTS "Users can view folders" ON public.document_folders;

CREATE POLICY "Users can view folders" 
ON public.document_folders 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR organization_id = get_user_organization_id(auth.uid()) 
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
  OR EXISTS (
    SELECT 1 FROM folder_shares fs 
    WHERE fs.folder_id = document_folders.id 
    AND fs.shared_with_organization_id = get_user_organization_id(auth.uid())
  )
);
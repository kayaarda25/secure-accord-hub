-- Create folders table for document organization
CREATE TABLE public.document_folders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    color TEXT DEFAULT '#c97c5d',
    icon TEXT DEFAULT 'folder'
);

-- Create tags table
CREATE TABLE public.document_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#c97c5d',
    organization_id UUID REFERENCES public.organizations(id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for document-tag relationship
CREATE TABLE public.document_tag_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(document_id, tag_id)
);

-- Add folder_id to documents table
ALTER TABLE public.documents ADD COLUMN folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL;

-- Create document templates table
CREATE TABLE public.document_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'contract',
    content JSONB NOT NULL DEFAULT '{}',
    organization_id UUID REFERENCES public.organizations(id),
    is_global BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_folders
CREATE POLICY "Users can view folders" ON public.document_folders
FOR SELECT USING (
    created_by = auth.uid() 
    OR organization_id = get_user_organization_id(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can create folders" ON public.document_folders
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own folders" ON public.document_folders
FOR UPDATE USING (
    created_by = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete own folders" ON public.document_folders
FOR DELETE USING (
    created_by = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for document_tags
CREATE POLICY "Users can view tags" ON public.document_tags
FOR SELECT USING (
    created_by = auth.uid() 
    OR organization_id = get_user_organization_id(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can create tags" ON public.document_tags
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own tags" ON public.document_tags
FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own tags" ON public.document_tags
FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for document_tag_assignments
CREATE POLICY "Users can view tag assignments" ON public.document_tag_assignments
FOR SELECT USING (true);

CREATE POLICY "Users can assign tags" ON public.document_tag_assignments
FOR INSERT WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Users can remove tag assignments" ON public.document_tag_assignments
FOR DELETE USING (assigned_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for document_templates
CREATE POLICY "Users can view templates" ON public.document_templates
FOR SELECT USING (
    is_global = true 
    OR created_by = auth.uid() 
    OR organization_id = get_user_organization_id(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can create templates" ON public.document_templates
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own templates" ON public.document_templates
FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own templates" ON public.document_templates
FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_document_folders_parent ON public.document_folders(parent_id);
CREATE INDEX idx_document_folders_org ON public.document_folders(organization_id);
CREATE INDEX idx_documents_folder ON public.documents(folder_id);
CREATE INDEX idx_document_tags_org ON public.document_tags(organization_id);
CREATE INDEX idx_document_templates_category ON public.document_templates(category);

-- Trigger for updated_at
CREATE TRIGGER update_document_folders_updated_at
    BEFORE UPDATE ON public.document_folders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at
    BEFORE UPDATE ON public.document_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
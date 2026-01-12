-- Create organization type enum
CREATE TYPE public.organization_type AS ENUM ('mgi_media', 'mgi_communications', 'gateway');

-- Add organization type to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS org_type organization_type;

-- Update existing organizations with their types
UPDATE public.organizations SET org_type = 'mgi_media' WHERE name ILIKE '%MGI M%' OR name ILIKE '%Media%';
UPDATE public.organizations SET org_type = 'mgi_communications' WHERE name ILIKE '%MGI C%' OR name ILIKE '%Communications%';
UPDATE public.organizations SET org_type = 'gateway' WHERE name ILIKE '%Gateway%';

-- Create organization permissions table
CREATE TABLE public.organization_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_type organization_type NOT NULL,
    can_create_declarations BOOLEAN NOT NULL DEFAULT false,
    can_create_invoices BOOLEAN NOT NULL DEFAULT false,
    can_create_opex BOOLEAN NOT NULL DEFAULT false,
    can_create_budget BOOLEAN NOT NULL DEFAULT false,
    can_view_declarations BOOLEAN NOT NULL DEFAULT false,
    can_view_invoices BOOLEAN NOT NULL DEFAULT false,
    can_view_opex BOOLEAN NOT NULL DEFAULT false,
    can_view_budget BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(org_type)
);

-- Insert default permissions
INSERT INTO public.organization_permissions (org_type, can_create_declarations, can_create_invoices, can_create_opex, can_create_budget, can_view_declarations, can_view_invoices, can_view_opex, can_view_budget) VALUES
    ('mgi_media', true, true, false, false, true, true, false, false),
    ('mgi_communications', false, false, true, false, false, false, true, false),
    ('gateway', false, false, true, true, true, true, true, true);

-- Enable RLS on organization_permissions
ALTER TABLE public.organization_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read permissions
CREATE POLICY "Everyone can view organization permissions" ON public.organization_permissions
    FOR SELECT USING (true);

-- Only admins can modify permissions
CREATE POLICY "Admins can manage organization permissions" ON public.organization_permissions
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create document sharing table
CREATE TABLE public.document_shares (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    shared_with_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT document_shares_check CHECK (
        shared_with_organization_id IS NOT NULL OR shared_with_user_id IS NOT NULL
    )
);

-- Enable RLS on document_shares
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Users can share documents they uploaded
CREATE POLICY "Users can create document shares" ON public.document_shares
    FOR INSERT WITH CHECK (shared_by = auth.uid());

-- Users can view shares relevant to them
CREATE POLICY "Users can view document shares" ON public.document_shares
    FOR SELECT USING (
        shared_by = auth.uid() OR
        shared_with_user_id = auth.uid() OR
        shared_with_organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    );

-- Users can delete their own shares
CREATE POLICY "Users can delete own shares" ON public.document_shares
    FOR DELETE USING (shared_by = auth.uid());

-- Create function to get user's organization type
CREATE OR REPLACE FUNCTION public.get_user_org_type(_user_id uuid)
RETURNS organization_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.org_type
    FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.user_id = _user_id
$$;

-- Create function to check if user can perform action
CREATE OR REPLACE FUNCTION public.can_perform_action(_user_id uuid, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE _action
        WHEN 'create_declarations' THEN op.can_create_declarations
        WHEN 'create_invoices' THEN op.can_create_invoices
        WHEN 'create_opex' THEN op.can_create_opex
        WHEN 'create_budget' THEN op.can_create_budget
        WHEN 'view_declarations' THEN op.can_view_declarations
        WHEN 'view_invoices' THEN op.can_view_invoices
        WHEN 'view_opex' THEN op.can_view_opex
        WHEN 'view_budget' THEN op.can_view_budget
        ELSE false
    END
    FROM organization_permissions op
    WHERE op.org_type = get_user_org_type(_user_id)
$$;

-- Create function to check if org is MGI (for Gateway view)
CREATE OR REPLACE FUNCTION public.is_mgi_organization(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT org_type IN ('mgi_media', 'mgi_communications')
    FROM organizations
    WHERE id = _org_id
$$;

-- Update documents RLS to include sharing
DROP POLICY IF EXISTS "Users can view documents" ON public.documents;

CREATE POLICY "Users can view documents" ON public.documents
    FOR SELECT USING (
        uploaded_by = auth.uid() OR
        has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'state'::app_role]) OR
        EXISTS (
            SELECT 1 FROM document_signatures ds
            WHERE ds.document_id = documents.id AND ds.signer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM document_shares ds
            WHERE ds.document_id = documents.id AND (
                ds.shared_with_user_id = auth.uid() OR
                ds.shared_with_organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
            )
        )
    );

-- Create trigger for updated_at on organization_permissions
CREATE TRIGGER update_organization_permissions_updated_at
    BEFORE UPDATE ON public.organization_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
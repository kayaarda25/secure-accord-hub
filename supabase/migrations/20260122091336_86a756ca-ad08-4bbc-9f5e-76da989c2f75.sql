-- Create table for storing Bexio OAuth tokens per organization
CREATE TABLE public.bexio_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.bexio_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins and finance users can view/manage Bexio tokens
CREATE POLICY "Admin and finance can view bexio tokens"
    ON public.bexio_tokens
    FOR SELECT
    USING (
        public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role])
        AND organization_id = public.get_user_organization_id(auth.uid())
    );

CREATE POLICY "Admin can manage bexio tokens"
    ON public.bexio_tokens
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        AND organization_id = public.get_user_organization_id(auth.uid())
    );

-- Add updated_at trigger
CREATE TRIGGER update_bexio_tokens_updated_at
    BEFORE UPDATE ON public.bexio_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add bexio_creditor_id to creditor_invoices for linking
ALTER TABLE public.creditor_invoices 
ADD COLUMN IF NOT EXISTS bexio_creditor_id INTEGER,
ADD COLUMN IF NOT EXISTS bexio_invoice_id INTEGER,
ADD COLUMN IF NOT EXISTS bexio_synced_at TIMESTAMP WITH TIME ZONE;
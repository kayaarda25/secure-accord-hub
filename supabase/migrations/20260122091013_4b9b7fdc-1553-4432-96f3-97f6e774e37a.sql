-- Create creditor invoices table for incoming invoices
CREATE TABLE public.creditor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT,
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  vendor_iban TEXT,
  vendor_vat_number TEXT,
  
  -- Financial details
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  vat_amount NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  
  -- Dates
  invoice_date DATE,
  due_date DATE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Document storage
  original_email_subject TEXT,
  original_email_from TEXT,
  document_path TEXT,
  document_name TEXT,
  
  -- AI extraction
  ai_confidence_score NUMERIC,
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  extraction_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Approval workflow (4-eyes principle)
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, first_approval, approved, rejected, paid, cancelled
  
  first_approver_id UUID,
  first_approved_at TIMESTAMP WITH TIME ZONE,
  first_approver_comment TEXT,
  
  second_approver_id UUID,
  second_approved_at TIMESTAMP WITH TIME ZONE,
  second_approver_comment TEXT,
  
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Bexio integration
  bexio_creditor_id TEXT,
  bexio_invoice_id TEXT,
  bexio_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, scheduled, paid, failed
  payment_reference TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Organization & Cost Center
  organization_id UUID REFERENCES organizations(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.creditor_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for creditor invoices
CREATE POLICY "Finance/Management can manage creditor invoices"
ON public.creditor_invoices FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

CREATE POLICY "Users can view creditor invoices"
ON public.creditor_invoices FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role, 'state'::app_role]));

-- Create approval history table
CREATE TABLE public.creditor_invoice_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES creditor_invoices(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  approval_type TEXT NOT NULL, -- first_approval, second_approval, rejection
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creditor_invoice_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval history"
ON public.creditor_invoice_approvals FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

CREATE POLICY "Approvers can create approvals"
ON public.creditor_invoice_approvals FOR INSERT
WITH CHECK (approver_id = auth.uid() AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

-- Create storage bucket for creditor invoice documents
INSERT INTO storage.buckets (id, name, public) VALUES ('creditor-invoices', 'creditor-invoices', false);

-- Storage policies
CREATE POLICY "Finance can upload creditor invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creditor-invoices' AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

CREATE POLICY "Finance can view creditor invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'creditor-invoices' AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

-- Trigger for updated_at
CREATE TRIGGER update_creditor_invoices_updated_at
BEFORE UPDATE ON creditor_invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
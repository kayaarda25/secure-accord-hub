-- Create documents table for contracts and other documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'contract', -- contract, license, report, other
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  description text,
  expires_at date,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create document signatures table
CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES auth.users(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending', -- pending, signed, rejected
  signed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  signature_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view documents" 
ON public.documents 
FOR SELECT 
USING (
  uploaded_by = auth.uid() 
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'state'::app_role])
  OR EXISTS (
    SELECT 1 FROM public.document_signatures ds 
    WHERE ds.document_id = documents.id AND ds.signer_id = auth.uid()
  )
);

CREATE POLICY "Users can upload documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploaders can update their documents" 
ON public.documents 
FOR UPDATE 
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Uploaders can delete their documents" 
ON public.documents 
FOR DELETE 
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for document signatures
CREATE POLICY "Users can view their signature requests" 
ON public.document_signatures 
FOR SELECT 
USING (
  signer_id = auth.uid() 
  OR requested_by = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can create signature requests" 
ON public.document_signatures 
FOR INSERT 
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Signers can update their signature status" 
ON public.document_signatures 
FOR UPDATE 
USING (signer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies for documents bucket
CREATE POLICY "Users can view document files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Users can upload document files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their document files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their document files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add trigger for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_signatures_updated_at
BEFORE UPDATE ON public.document_signatures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
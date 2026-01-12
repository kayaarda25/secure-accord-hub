-- Add signature_position column to document_signatures table
ALTER TABLE public.document_signatures 
ADD COLUMN IF NOT EXISTS signature_position TEXT DEFAULT 'bottom-right';

-- Add comment for documentation
COMMENT ON COLUMN public.document_signatures.signature_position IS 'Position of signature on document: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right';
-- Add soft-delete column to documents
ALTER TABLE public.documents ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient trash queries
CREATE INDEX idx_documents_deleted_at ON public.documents (deleted_at) WHERE deleted_at IS NOT NULL;

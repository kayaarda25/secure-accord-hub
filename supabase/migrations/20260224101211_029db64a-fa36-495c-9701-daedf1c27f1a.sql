
-- Table to track QR-code-based upload sessions
CREATE TABLE public.receipt_upload_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.receipt_upload_sessions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.receipt_upload_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Owner can create sessions
CREATE POLICY "Users can create sessions"
  ON public.receipt_upload_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owner can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.receipt_upload_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Anyone with the code can update (for mobile upload without auth)
CREATE POLICY "Anyone can update by session code"
  ON public.receipt_upload_sessions FOR UPDATE
  USING (true);

-- Anyone can read by session code (for mobile upload page)
CREATE POLICY "Anyone can read by session code"
  ON public.receipt_upload_sessions FOR SELECT
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipt_upload_sessions;

-- Storage bucket for receipt uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('receipt-uploads', 'receipt-uploads', true);

-- Anyone can upload to receipt-uploads bucket (mobile users won't be authenticated)
CREATE POLICY "Anyone can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipt-uploads');

-- Anyone can read receipt uploads
CREATE POLICY "Anyone can read receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipt-uploads');

-- Owner can delete their receipt uploads
CREATE POLICY "Authenticated users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipt-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

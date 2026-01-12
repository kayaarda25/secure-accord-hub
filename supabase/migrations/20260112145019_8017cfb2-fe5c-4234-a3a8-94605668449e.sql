-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for backups bucket - only admins can access
CREATE POLICY "Admins can view backups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'backups' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "System can insert backups"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Admins can delete old backups"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'backups' 
  AND public.has_role(auth.uid(), 'admin')
);
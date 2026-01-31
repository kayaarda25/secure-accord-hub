-- Create letterhead_settings table for custom document headers
CREATE TABLE public.letterhead_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT 'MGI × AFRIKA',
  subtitle TEXT DEFAULT 'Government Cooperation Platform',
  address TEXT DEFAULT 'Zürich, Switzerland',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#c97c5d',
  show_logo BOOLEAN DEFAULT false,
  footer_text TEXT DEFAULT 'Confidential',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letterhead_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own letterhead settings
CREATE POLICY "Users can manage own letterhead settings"
  ON public.letterhead_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_letterhead_settings_updated_at
  BEFORE UPDATE ON public.letterhead_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
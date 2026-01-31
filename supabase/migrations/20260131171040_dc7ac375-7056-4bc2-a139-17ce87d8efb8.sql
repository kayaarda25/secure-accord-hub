-- Add preset name and make it support multiple presets per user
ALTER TABLE public.letterhead_settings 
ADD COLUMN IF NOT EXISTS preset_name TEXT NOT NULL DEFAULT 'Standard',
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Remove the unique constraint on user_id if it exists and add a composite unique constraint
ALTER TABLE public.letterhead_settings DROP CONSTRAINT IF EXISTS letterhead_settings_user_id_key;

-- Create a unique constraint for user_id + preset_name
ALTER TABLE public.letterhead_settings 
ADD CONSTRAINT letterhead_settings_user_preset_unique UNIQUE (user_id, preset_name);

-- Update RLS policies to allow multiple presets
DROP POLICY IF EXISTS "Users can manage own letterhead settings" ON public.letterhead_settings;

CREATE POLICY "Users can view own letterhead settings" 
ON public.letterhead_settings 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own letterhead settings" 
ON public.letterhead_settings 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own letterhead settings" 
ON public.letterhead_settings 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own letterhead settings" 
ON public.letterhead_settings 
FOR DELETE 
USING (user_id = auth.uid());
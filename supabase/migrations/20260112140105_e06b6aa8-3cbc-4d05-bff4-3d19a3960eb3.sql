-- Add signature_data column to profiles for storing user's signature
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Add signature_type column (text for initials, image for drawn signature)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_type TEXT DEFAULT 'text';

-- Add signature_initials column for text-based signatures
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_initials TEXT;

-- Add signature image to document_signatures when signing
ALTER TABLE public.document_signatures 
ADD COLUMN IF NOT EXISTS signature_image TEXT;
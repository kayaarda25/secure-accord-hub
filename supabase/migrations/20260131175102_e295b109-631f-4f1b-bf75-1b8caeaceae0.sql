-- Store users' public keys for E2E encryption
CREATE TABLE public.user_public_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

-- Users can read any public key (needed to encrypt messages for recipients)
CREATE POLICY "Anyone can read public keys"
ON public.user_public_keys
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own public key
CREATE POLICY "Users can insert own public key"
ON public.user_public_keys
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own public key
CREATE POLICY "Users can update own public key"
ON public.user_public_keys
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_public_keys_updated_at
BEFORE UPDATE ON public.user_public_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

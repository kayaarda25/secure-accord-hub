-- Add encrypted_content column to store E2E encrypted message payloads
ALTER TABLE public.communication_messages
ADD COLUMN IF NOT EXISTS encrypted_content text NULL;

COMMENT ON COLUMN public.communication_messages.encrypted_content IS 'JSON object mapping user_id to {iv, ciphertext} for E2E encrypted messages';

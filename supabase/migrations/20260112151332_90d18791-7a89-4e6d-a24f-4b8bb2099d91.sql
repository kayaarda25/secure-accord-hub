-- Add login_attempts table for tracking failed logins
CREATE TABLE public.login_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only (no direct user access)
CREATE POLICY "Service role can manage login attempts"
ON public.login_attempts
FOR ALL
USING (false)
WITH CHECK (false);

-- Add index for efficient queries
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at);
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at);

-- Create function to check if login is blocked
CREATE OR REPLACE FUNCTION public.is_login_blocked(
    _email TEXT,
    _ip_address TEXT DEFAULT NULL,
    _max_attempts INTEGER DEFAULT 5,
    _lockout_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM (
            SELECT COUNT(*) as failed_count
            FROM public.login_attempts
            WHERE email = _email
              AND success = false
              AND attempted_at > now() - (_lockout_minutes || ' minutes')::interval
        ) AS recent_failures
        WHERE recent_failures.failed_count >= _max_attempts
    )
$$;

-- Create function to log login attempt
CREATE OR REPLACE FUNCTION public.log_login_attempt(
    _email TEXT,
    _ip_address TEXT DEFAULT NULL,
    _user_agent TEXT DEFAULT NULL,
    _success BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, ip_address, user_agent, success)
    VALUES (_email, _ip_address, _user_agent, _success);
    
    -- Clean up old attempts (older than 24 hours)
    DELETE FROM public.login_attempts
    WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- Add is_current column to user_sessions to identify current session
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;

-- Add index for security_settings allowed_ips queries
CREATE INDEX IF NOT EXISTS idx_security_settings_user ON public.security_settings(user_id);
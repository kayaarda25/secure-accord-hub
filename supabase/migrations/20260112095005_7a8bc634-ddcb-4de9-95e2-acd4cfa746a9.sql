-- Fix overly permissive RLS policy for audit_logs INSERT
-- Replace the "System can insert audit logs" policy with a more restrictive one

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Only authenticated users can create audit logs for their own actions
CREATE POLICY "Authenticated users can create audit logs" ON public.audit_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
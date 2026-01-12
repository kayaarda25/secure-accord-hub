
-- Fix overly permissive INSERT policy on notifications
-- Replace WITH CHECK (true) with a more specific check
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

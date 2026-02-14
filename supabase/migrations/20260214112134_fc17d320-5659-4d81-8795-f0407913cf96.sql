
CREATE OR REPLACE FUNCTION public.get_login_attempts_for_admin()
RETURNS TABLE(
  id uuid,
  email text,
  ip_address text,
  user_agent text,
  success boolean,
  attempted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT la.id, la.email, la.ip_address, la.user_agent, la.success, la.attempted_at
  FROM public.login_attempts la
  ORDER BY la.attempted_at DESC
  LIMIT 200;
END;
$$;

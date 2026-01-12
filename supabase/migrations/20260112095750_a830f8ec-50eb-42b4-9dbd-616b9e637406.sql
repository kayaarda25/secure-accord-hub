-- Update RLS policy for user_roles to allow admins to manage roles
DROP POLICY IF EXISTS "State/Management can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles policy to allow admins to view and manage all profiles
CREATE POLICY "Admins can manage profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view audit logs
DROP POLICY IF EXISTS "State/Management can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins and State/Management can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role])
);
-- Fix: Restrict Profile Visibility (previously any authenticated user could see all profiles)

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can always view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Users can view profiles from the same organization OR if they have admin/management role
CREATE POLICY "Users can view organization profiles" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (
    -- Same organization
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    -- OR admin/management can see all profiles
    OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
  );
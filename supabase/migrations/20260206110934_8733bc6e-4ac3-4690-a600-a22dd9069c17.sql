-- Create a security definer function to get users from any organization for sharing purposes
CREATE OR REPLACE FUNCTION public.get_organization_users_for_sharing(org_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.organization_id
  FROM profiles p
  WHERE p.organization_id = org_id
    AND p.is_active = true
  ORDER BY p.first_name, p.last_name, p.email;
END;
$$;
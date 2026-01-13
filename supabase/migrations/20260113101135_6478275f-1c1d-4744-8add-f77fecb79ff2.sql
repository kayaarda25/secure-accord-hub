-- Create invitations table to track user invitations
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  department TEXT,
  position TEXT,
  roles app_role[] DEFAULT '{}',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(email, status) -- Prevent duplicate pending invitations
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Anyone can view their own invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token"
ON public.user_invitations
FOR SELECT
TO anon, authenticated
USING (status = 'pending' AND expires_at > now());

-- Index for faster lookups
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX idx_user_invitations_status ON public.user_invitations(status);
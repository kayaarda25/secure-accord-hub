
-- Seed permission definitions (ignore conflicts)
INSERT INTO public.permission_definitions (permission_key, label, description, category) VALUES
  ('admin.full_access', 'Vollzugriff', 'Uneingeschränkter Zugriff auf alle Module und Einstellungen', 'administration'),
  ('users.view', 'Benutzer anzeigen', 'Benutzerprofile und -listen einsehen', 'administration'),
  ('users.manage', 'Benutzer verwalten', 'Benutzer erstellen, bearbeiten und deaktivieren', 'administration'),
  ('permissions.manage', 'Berechtigungen verwalten', 'Benutzerberechtigungen zuweisen und entziehen', 'administration'),
  ('security.manage', 'Sicherheit verwalten', 'Sicherheitseinstellungen, 2FA und IP-Beschränkungen', 'administration'),
  ('audit.view', 'Audit-Logs einsehen', 'Aktivitätsprotokolle und Systemlogs einsehen', 'administration'),
  ('invoices.view', 'Rechnungen anzeigen', 'Rechnungsübersicht und -details einsehen', 'finance'),
  ('invoices.approve', 'Rechnungen freigeben', 'Lieferantenrechnungen genehmigen oder ablehnen', 'finance'),
  ('opex.view', 'OPEX anzeigen', 'Betriebsausgaben einsehen', 'finance'),
  ('opex.approve', 'OPEX genehmigen', 'Betriebsausgaben-Budgets genehmigen', 'finance'),
  ('payments.confirm', 'Zahlungen bestätigen', 'Zahlungsanweisungen freigeben', 'finance'),
  ('budget.view', 'Budget anzeigen', 'Budgetpläne und Forecasts einsehen', 'finance'),
  ('budget.manage', 'Budget verwalten', 'Budgetpläne erstellen und bearbeiten', 'finance'),
  ('declarations.view', 'Deklarationen anzeigen', 'Deklarationen einsehen', 'finance'),
  ('declarations.manage', 'Deklarationen verwalten', 'Deklarationen erstellen und bearbeiten', 'finance'),
  ('documents.view', 'Dokumente anzeigen', 'Dokumente und Verträge einsehen', 'documents'),
  ('documents.upload', 'Dokumente hochladen', 'Dateien hochladen und verwalten', 'documents'),
  ('documents.delete', 'Dokumente löschen', 'Dokumente dauerhaft entfernen', 'documents'),
  ('documents.sign', 'Dokumente signieren', 'Dokumente digital unterschreiben', 'documents'),
  ('employees.view', 'Mitarbeiter anzeigen', 'Mitarbeiterdaten einsehen', 'hr'),
  ('employees.manage', 'Mitarbeiter verwalten', 'Mitarbeiterdaten erstellen und bearbeiten', 'hr'),
  ('expenses.view', 'Spesen anzeigen', 'Spesenanträge einsehen', 'hr'),
  ('expenses.approve', 'Spesen genehmigen', 'Spesenanträge genehmigen oder ablehnen', 'hr'),
  ('vacations.view', 'Ferien anzeigen', 'Ferienanträge einsehen', 'hr'),
  ('vacations.approve', 'Ferien genehmigen', 'Ferienanträge genehmigen oder ablehnen', 'hr'),
  ('payroll.view', 'Lohn einsehen', 'Lohnabrechnungen und -daten einsehen', 'hr'),
  ('communication.view', 'Kommunikation anzeigen', 'Nachrichten und Threads einsehen', 'communication'),
  ('communication.manage', 'Kommunikation verwalten', 'Threads erstellen und moderieren', 'communication')
ON CONFLICT (permission_key) DO NOTHING;

-- Create has_permission security definer function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id
      AND (permission_key = _permission OR permission_key = 'admin.full_access')
  )
$$;

-- Create has_any_permission security definer function
CREATE OR REPLACE FUNCTION public.has_any_permission(_user_id uuid, _permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id
      AND (permission_key = ANY(_permissions) OR permission_key = 'admin.full_access')
  )
$$;

-- Rewrite has_role to check permissions instead of user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission_key = 'admin.full_access'
    )
    WHEN 'management' THEN EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id 
      AND permission_key IN ('admin.full_access','employees.manage','vacations.approve','expenses.approve','budget.manage','documents.sign','users.manage','communication.manage')
    )
    WHEN 'finance' THEN EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id 
      AND permission_key IN ('admin.full_access','invoices.approve','opex.approve','payments.confirm','budget.manage','payroll.view','declarations.manage')
    )
    WHEN 'state' THEN EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id 
      AND permission_key IN ('admin.full_access','audit.view','declarations.view','budget.view','opex.view')
    )
    WHEN 'partner' THEN EXISTS (
      SELECT 1 FROM public.user_permissions WHERE user_id = _user_id 
      AND permission_key IN ('admin.full_access','communication.view','documents.view')
    )
    ELSE false
  END
$$;

-- Rewrite has_any_role to use the new has_role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(_roles) AS r(role)
    WHERE public.has_role(_user_id, r.role)
  )
$$;

-- Migrate existing user_roles to user_permissions
INSERT INTO public.user_permissions (user_id, permission_key, granted_by)
SELECT ur.user_id, 'admin.full_access', ur.user_id
FROM public.user_roles ur WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission_key, granted_by)
SELECT ur.user_id, unnest(ARRAY[
  'employees.manage','employees.view','vacations.approve','vacations.view',
  'expenses.approve','expenses.view','budget.manage','budget.view',
  'documents.sign','documents.view','documents.upload',
  'users.manage','users.view','communication.manage','communication.view',
  'payroll.view','audit.view'
]), ur.user_id
FROM public.user_roles ur WHERE ur.role = 'management'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission_key, granted_by)
SELECT ur.user_id, unnest(ARRAY[
  'invoices.view','invoices.approve','opex.view','opex.approve',
  'payments.confirm','budget.view','budget.manage',
  'declarations.view','declarations.manage','payroll.view',
  'employees.view','expenses.view','expenses.approve'
]), ur.user_id
FROM public.user_roles ur WHERE ur.role = 'finance'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission_key, granted_by)
SELECT ur.user_id, unnest(ARRAY[
  'audit.view','declarations.view','budget.view','opex.view',
  'documents.view','employees.view','communication.view'
]), ur.user_id
FROM public.user_roles ur WHERE ur.role = 'state'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, permission_key, granted_by)
SELECT ur.user_id, unnest(ARRAY[
  'communication.view','documents.view'
]), ur.user_id
FROM public.user_roles ur WHERE ur.role = 'partner'
ON CONFLICT DO NOTHING;

-- Create four_eyes_rules table
CREATE TABLE IF NOT EXISTS public.four_eyes_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL UNIQUE,
  approver_user_ids UUID[] NOT NULL DEFAULT '{}',
  required_approvals INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.four_eyes_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissions managers can manage four-eyes rules"
  ON public.four_eyes_rules FOR ALL
  USING (public.has_any_permission(auth.uid(), ARRAY['admin.full_access', 'permissions.manage']));

CREATE POLICY "Authenticated users can view four-eyes rules"
  ON public.four_eyes_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create four_eyes_approvals table
CREATE TABLE IF NOT EXISTS public.four_eyes_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.four_eyes_rules(id) ON DELETE CASCADE NOT NULL,
  target_record_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  approver_id UUID NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comment TEXT
);

ALTER TABLE public.four_eyes_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvers can create four-eyes approvals"
  ON public.four_eyes_approvals FOR INSERT
  WITH CHECK (approver_id = auth.uid());

CREATE POLICY "Users can view four-eyes approvals"
  ON public.four_eyes_approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

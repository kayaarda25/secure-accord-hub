
-- 1. Multi-Bexio accounts per organization
CREATE TABLE public.bexio_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL DEFAULT 'Standard',
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  is_active boolean NOT NULL DEFAULT true,
  entity_type text NOT NULL DEFAULT 'default',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bexio_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org bexio accounts"
  ON public.bexio_accounts FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage bexio accounts"
  ON public.bexio_accounts FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

-- 2. Add invoice_type (creditor/debitor) + bexio_account_id to creditor_invoices
ALTER TABLE public.creditor_invoices 
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'creditor',
  ADD COLUMN IF NOT EXISTS bexio_account_id uuid REFERENCES public.bexio_accounts(id);

-- 3. OPEX budgets table (approve entire budget, not individual expenses)
CREATE TABLE public.opex_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  period text NOT NULL, -- YYYY-MM
  currency text NOT NULL DEFAULT 'CHF',
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cost_center_id, period)
);

ALTER TABLE public.opex_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view opex budgets"
  ON public.opex_budgets FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

CREATE POLICY "Users can create opex budgets"
  ON public.opex_budgets FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Approvers can update opex budgets"
  ON public.opex_budgets FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]));

CREATE POLICY "Admins can delete opex budgets"
  ON public.opex_budgets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. OPEX sub-items (multiple items per category)
CREATE TABLE public.opex_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.opex_budgets(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opex_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view line items"
  ON public.opex_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM opex_budgets b WHERE b.id = budget_id AND (b.submitted_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'management'::app_role]))));

CREATE POLICY "Budget owners can manage line items"
  ON public.opex_line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM opex_budgets b WHERE b.id = budget_id AND b.submitted_by = auth.uid()));

-- 5. Granular permissions system
CREATE TABLE public.permission_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view permission definitions"
  ON public.permission_definitions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage permission definitions"
  ON public.permission_definitions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User-level permission assignments
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

CREATE POLICY "Admins can manage user permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

-- Four-eyes principle table
CREATE TABLE public.approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  required_approvers integer NOT NULL DEFAULT 2,
  organization_id uuid REFERENCES public.organizations(id),
  approver_user_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval rules"
  ON public.approval_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage approval rules"
  ON public.approval_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

-- Insert default granular permissions
INSERT INTO public.permission_definitions (permission_key, label, description, category) VALUES
  ('invoices.approve', 'Rechnungen freigeben', 'Kann Rechnungen genehmigen', 'finance'),
  ('invoices.create', 'Rechnungen erstellen', 'Kann Rechnungen anlegen', 'finance'),
  ('invoices.view', 'Rechnungen einsehen', 'Kann Rechnungen ansehen', 'finance'),
  ('opex.approve', 'OPEX genehmigen', 'Kann OPEX-Budgets genehmigen', 'finance'),
  ('opex.create', 'OPEX erstellen', 'Kann OPEX-Einträge erstellen', 'finance'),
  ('opex.view', 'OPEX einsehen', 'Kann OPEX einsehen', 'finance'),
  ('documents.sign', 'Dokumente signieren', 'Kann Dokumente digital signieren', 'documents'),
  ('documents.upload', 'Dokumente hochladen', 'Kann Dokumente hochladen', 'documents'),
  ('documents.delete', 'Dokumente löschen', 'Kann Dokumente löschen', 'documents'),
  ('payments.confirm', 'Zahlungen bestätigen', 'Kann Zahlungen freigeben', 'finance'),
  ('declarations.create', 'Deklarationen erstellen', 'Kann Deklarationen anlegen', 'finance'),
  ('declarations.approve', 'Deklarationen genehmigen', 'Kann Deklarationen genehmigen', 'finance'),
  ('employees.manage', 'Mitarbeiter verwalten', 'Kann Mitarbeiterdaten bearbeiten', 'hr'),
  ('employees.view', 'Mitarbeiter einsehen', 'Kann Mitarbeiterdaten einsehen', 'hr'),
  ('payroll.manage', 'Lohnbuchhaltung', 'Kann Lohnabrechnungen verwalten', 'hr'),
  ('users.manage', 'Benutzer verwalten', 'Kann Benutzerkonten verwalten', 'admin'),
  ('settings.manage', 'Einstellungen verwalten', 'Kann Systemeinstellungen ändern', 'admin'),
  ('budget.manage', 'Budget verwalten', 'Kann Budgets planen und ändern', 'finance'),
  ('reports.view', 'Berichte einsehen', 'Kann Berichte generieren und einsehen', 'reports'),
  ('four_eyes.invoices', 'Vier-Augen-Prinzip Rechnungen', 'Muss Rechnungen im Vier-Augen-Prinzip freigeben', 'compliance');

-- Security definer function for permission checks
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission_key
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- 6. Add preferred_language to profiles for first-login language selection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT NULL;

-- 7. Employee extended HR data table
CREATE TABLE public.employee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  ahv_number text,
  marital_status text,
  children_count integer DEFAULT 0,
  monthly_salary numeric,
  employment_type text DEFAULT 'full_time',
  employment_start date,
  employment_end date,
  nationality text,
  birth_date date,
  address text,
  bank_iban text,
  emergency_contact text,
  notes text,
  is_system_user boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can manage employee records"
  ON public.employee_records FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

CREATE POLICY "Users can view own employee record"
  ON public.employee_records FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

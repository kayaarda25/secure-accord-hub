-- ===========================================
-- MGI × AFRIKA STATE COOPERATION PLATFORM
-- Complete Database Schema with RBAC & Audit
-- ===========================================

-- 1. ENUM TYPES
-- ===========================================

-- User roles: state (Staat), management, finance, partner
CREATE TYPE public.app_role AS ENUM ('state', 'management', 'finance', 'partner');

-- OPEX approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved_supervisor', 'approved_finance', 'rejected');

-- Document status
CREATE TYPE public.document_status AS ENUM ('valid', 'expiring', 'expired', 'draft');

-- Communication type
CREATE TYPE public.communication_type AS ENUM ('partner', 'authority', 'internal');

-- Message priority
CREATE TYPE public.message_priority AS ENUM ('normal', 'important', 'urgent');

-- ===========================================
-- 2. CORE TABLES
-- ===========================================

-- Partners & Authorities (needed for profile references)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('partner', 'authority', 'internal')),
  country TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles with full details
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  department TEXT,
  position TEXT,
  phone TEXT,
  avatar_url TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Cost centers for OPEX
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  country TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  budget_annual DECIMAL(15,2) DEFAULT 0,
  budget_used DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- 3. OPEX MODULE
-- ===========================================

-- OPEX expenses with approval workflow
CREATE TABLE public.opex_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Submitter
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Approval workflow (2-stage)
  status approval_status NOT NULL DEFAULT 'pending',
  
  -- Stage 1: Supervisor approval
  supervisor_id UUID,
  supervisor_approved_at TIMESTAMPTZ,
  supervisor_comment TEXT,
  
  -- Stage 2: Finance approval
  finance_approver_id UUID,
  finance_approved_at TIMESTAMPTZ,
  finance_comment TEXT,
  
  -- Rejection info
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OPEX receipts/documents
CREATE TABLE public.opex_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.opex_expenses(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- 4. COMMUNICATION MODULE
-- ===========================================

-- Communication threads
CREATE TABLE public.communication_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  type communication_type NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_official BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages in threads
CREATE TABLE public.communication_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.communication_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  priority message_priority DEFAULT 'normal',
  is_decision BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting protocols
CREATE TABLE public.meeting_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.communication_threads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  location TEXT,
  attendees TEXT[],
  agenda TEXT,
  minutes TEXT,
  decisions TEXT,
  action_items JSONB DEFAULT '[]',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document links to communications
CREATE TABLE public.communication_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES public.meeting_protocols(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (thread_id IS NOT NULL OR message_id IS NOT NULL OR protocol_id IS NOT NULL)
);

-- ===========================================
-- 5. AUDIT LOGS
-- ===========================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- 6. SECURITY FUNCTIONS
-- ===========================================

-- Function to check if user has a specific role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- ===========================================
-- 7. TRIGGERS
-- ===========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opex_expenses_updated_at BEFORE UPDATE ON public.opex_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_communication_threads_updated_at BEFORE UPDATE ON public.communication_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_communication_messages_updated_at BEFORE UPDATE ON public.communication_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meeting_protocols_updated_at BEFORE UPDATE ON public.meeting_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate expense number
CREATE OR REPLACE FUNCTION public.generate_expense_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expense_number = 'EXP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('expense_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS expense_number_seq START 1;
CREATE TRIGGER generate_expense_number_trigger BEFORE INSERT ON public.opex_expenses FOR EACH ROW EXECUTE FUNCTION public.generate_expense_number();

-- Profile creation trigger on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- 8. ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- USER ROLES POLICIES (only state/management can manage)
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "State/Management can manage roles" ON public.user_roles FOR ALL TO authenticated 
  USING (public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]));

-- ORGANIZATIONS POLICIES
CREATE POLICY "All users can view organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "State/Management can manage organizations" ON public.organizations FOR ALL TO authenticated 
  USING (public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]));

-- COST CENTERS POLICIES
CREATE POLICY "All users can view cost centers" ON public.cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance/Management can manage cost centers" ON public.cost_centers FOR ALL TO authenticated 
  USING (public.has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role]));

-- OPEX EXPENSES POLICIES
CREATE POLICY "Users can view OPEX based on role" ON public.opex_expenses FOR SELECT TO authenticated USING (
  submitted_by = auth.uid() OR
  supervisor_id = auth.uid() OR
  public.has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'state'::app_role])
);
CREATE POLICY "Users can submit OPEX" ON public.opex_expenses FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Users can update own pending OPEX" ON public.opex_expenses FOR UPDATE TO authenticated USING (
  (submitted_by = auth.uid() AND status = 'pending') OR
  supervisor_id = auth.uid() OR
  public.has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role])
);

-- OPEX RECEIPTS POLICIES
CREATE POLICY "Users can view receipts" ON public.opex_receipts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.opex_expenses e 
    WHERE e.id = expense_id AND (
      e.submitted_by = auth.uid() OR
      e.supervisor_id = auth.uid() OR
      public.has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'state'::app_role])
    )
  )
);
CREATE POLICY "Users can upload receipts to own expenses" ON public.opex_receipts FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- COMMUNICATION POLICIES
CREATE POLICY "Users can view threads based on type" ON public.communication_threads FOR SELECT TO authenticated USING (
  type = 'internal' OR
  created_by = auth.uid() OR
  (type = 'partner' AND public.has_any_role(auth.uid(), ARRAY['management'::app_role, 'partner'::app_role])) OR
  (type = 'authority' AND public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]))
);
CREATE POLICY "Users can create threads" ON public.communication_threads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own threads" ON public.communication_threads FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages in accessible threads" ON public.communication_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.communication_threads t WHERE t.id = thread_id)
);
CREATE POLICY "Users can send messages" ON public.communication_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- MEETING PROTOCOLS POLICIES
CREATE POLICY "Users can view meeting protocols" ON public.meeting_protocols FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR
  public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role])
);
CREATE POLICY "Users can create meeting protocols" ON public.meeting_protocols FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own protocols" ON public.meeting_protocols FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- COMMUNICATION DOCUMENTS POLICIES
CREATE POLICY "Users can view communication documents" ON public.communication_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upload communication documents" ON public.communication_documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- AUDIT LOGS POLICIES (only state/management can view)
CREATE POLICY "State/Management can view audit logs" ON public.audit_logs FOR SELECT TO authenticated 
  USING (public.has_any_role(auth.uid(), ARRAY['state'::app_role, 'management'::app_role]));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ===========================================
-- 9. STORAGE BUCKET FOR RECEIPTS
-- ===========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

-- Storage policies
CREATE POLICY "Users can view own receipts" ON storage.objects FOR SELECT TO authenticated 
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload receipts" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Finance/Management can view all receipts" ON storage.objects FOR SELECT TO authenticated 
  USING (bucket_id = 'receipts' AND public.has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role]));

-- ===========================================
-- 10. INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_opex_expenses_submitted_by ON public.opex_expenses(submitted_by);
CREATE INDEX idx_opex_expenses_status ON public.opex_expenses(status);
CREATE INDEX idx_opex_expenses_cost_center ON public.opex_expenses(cost_center_id);
CREATE INDEX idx_communication_threads_type ON public.communication_threads(type);
CREATE INDEX idx_communication_messages_thread ON public.communication_messages(thread_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =============================================
-- PHASE 1: DATABASE TABLES FOR ALL NEW FEATURES
-- =============================================

-- 1. NOTIFICATIONS SYSTEM
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'document', 'expense', 'calendar', 'system', 'approval', 'budget')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  task_notifications BOOLEAN DEFAULT true,
  document_notifications BOOLEAN DEFAULT true,
  expense_notifications BOOLEAN DEFAULT true,
  calendar_notifications BOOLEAN DEFAULT true,
  approval_notifications BOOLEAN DEFAULT true,
  budget_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2. CONTACTS (for Partners & Authorities)
-- =============================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('partner', 'authority', 'vendor', 'other')),
  name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts"
  ON public.contacts FOR SELECT
  USING (true);

CREATE POLICY "Management can manage contacts"
  ON public.contacts FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'state'::app_role]));

-- 3. CONTRACTS
-- =============================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contract_number TEXT,
  start_date DATE,
  end_date DATE,
  value NUMERIC,
  currency TEXT DEFAULT 'CHF',
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts"
  ON public.contracts FOR SELECT
  USING (true);

CREATE POLICY "Management can manage contracts"
  ON public.contracts FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

-- 4. BUDGET PLANNING
-- =============================================
CREATE TABLE public.budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  q1_amount NUMERIC DEFAULT 0,
  q2_amount NUMERIC DEFAULT 0,
  q3_amount NUMERIC DEFAULT 0,
  q4_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.budget_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id UUID REFERENCES public.budget_plans(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_amount NUMERIC NOT NULL,
  actual_amount NUMERIC DEFAULT 0,
  variance NUMERIC GENERATED ALWAYS AS (actual_amount - forecast_amount) STORED,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  threshold_percent INTEGER DEFAULT 80 CHECK (threshold_percent > 0 AND threshold_percent <= 100),
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;

-- Budget RLS Policies
CREATE POLICY "Users can view budget plans"
  ON public.budget_plans FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role, 'state'::app_role]));

CREATE POLICY "Finance/Management can manage budget plans"
  ON public.budget_plans FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

CREATE POLICY "Users can view budget forecasts"
  ON public.budget_forecasts FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role, 'state'::app_role]));

CREATE POLICY "Finance/Management can manage budget forecasts"
  ON public.budget_forecasts FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

CREATE POLICY "Users can view budget alerts"
  ON public.budget_alerts FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

CREATE POLICY "Finance can manage budget alerts"
  ON public.budget_alerts FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role]));

-- 5. DASHBOARD LAYOUTS
-- =============================================
CREATE TABLE public.user_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  layout JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dashboard layout"
  ON public.user_dashboard_layouts FOR ALL
  USING (user_id = auth.uid());

-- 6. SECURITY & SESSIONS
-- =============================================
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  backup_codes TEXT[],
  allowed_ips TEXT[],
  session_timeout_minutes INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own sessions"
  ON public.user_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own security settings"
  ON public.security_settings FOR ALL
  USING (user_id = auth.uid());

-- 7. SCHEDULED REPORTS
-- =============================================
CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('opex', 'declarations', 'budget', 'compliance', 'financial_summary')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  recipients TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports they created"
  ON public.scheduled_reports FOR SELECT
  USING (created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

CREATE POLICY "Users can manage own reports"
  ON public.scheduled_reports FOR ALL
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 8. EXTEND DECLARATIONS FOR APPROVAL WORKFLOW
-- =============================================
ALTER TABLE public.declarations 
  ADD COLUMN IF NOT EXISTS supervisor_id UUID,
  ADD COLUMN IF NOT EXISTS supervisor_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_comment TEXT,
  ADD COLUMN IF NOT EXISTS finance_comment TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 9. TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_plans_updated_at
  BEFORE UPDATE ON public.budget_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_security_settings_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX idx_contacts_type ON public.contacts(type);
CREATE INDEX idx_contracts_organization_id ON public.contracts(organization_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_budget_plans_fiscal_year ON public.budget_plans(fiscal_year);
CREATE INDEX idx_budget_plans_cost_center_id ON public.budget_plans(cost_center_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at);

-- =============================================
-- HR MODULE: Ferienmanagement & Sozialversicherungen
-- =============================================

-- Vacation entitlements per employee per year
CREATE TABLE public.vacation_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year integer NOT NULL,
    total_days integer NOT NULL DEFAULT 25,
    carried_over integer NOT NULL DEFAULT 0,
    used_days integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, year)
);

-- Vacation requests
CREATE TABLE public.vacation_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count integer NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id),
    rejected_at timestamptz,
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Social insurance records per employee
CREATE TABLE public.social_insurance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year integer NOT NULL,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    gross_salary numeric(12,2) NOT NULL DEFAULT 0,
    ahv_iv_eo_employee numeric(12,2) NOT NULL DEFAULT 0,
    ahv_iv_eo_employer numeric(12,2) NOT NULL DEFAULT 0,
    alv_employee numeric(12,2) NOT NULL DEFAULT 0,
    alv_employer numeric(12,2) NOT NULL DEFAULT 0,
    bvg_employee numeric(12,2) NOT NULL DEFAULT 0,
    bvg_employer numeric(12,2) NOT NULL DEFAULT 0,
    uvg_nbu numeric(12,2) NOT NULL DEFAULT 0,
    uvg_bu numeric(12,2) NOT NULL DEFAULT 0,
    ktg numeric(12,2) NOT NULL DEFAULT 0,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, year, month)
);

-- Enable RLS
ALTER TABLE public.vacation_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_insurance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_entitlements
CREATE POLICY "Users can view own entitlements"
ON public.vacation_entitlements FOR SELECT
USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

CREATE POLICY "HR can manage entitlements"
ON public.vacation_entitlements FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

-- RLS Policies for vacation_requests
CREATE POLICY "Users can view own requests"
ON public.vacation_requests FOR SELECT
USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role]));

CREATE POLICY "Users can create own requests"
ON public.vacation_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending requests"
ON public.vacation_requests FOR UPDATE
USING (
    (user_id = auth.uid() AND status = 'pending')
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role])
);

CREATE POLICY "Users can delete own pending requests"
ON public.vacation_requests FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');

-- RLS Policies for social_insurance_records
CREATE POLICY "Users can view own insurance records"
ON public.social_insurance_records FOR SELECT
USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

CREATE POLICY "HR/Finance can manage insurance records"
ON public.social_insurance_records FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role]));

-- Triggers for updated_at
CREATE TRIGGER update_vacation_entitlements_updated_at
BEFORE UPDATE ON public.vacation_entitlements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vacation_requests_updated_at
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_insurance_records_updated_at
BEFORE UPDATE ON public.social_insurance_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
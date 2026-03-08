
-- Create hr_expenses table
CREATE TABLE public.hr_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employee_records(id) ON DELETE CASCADE NOT NULL,
  submitted_by UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CHF',
  receipt_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_expenses ENABLE ROW LEVEL SECURITY;

-- Employees can view their own expenses
CREATE POLICY "Users can view own expenses"
  ON public.hr_expenses FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
  );

-- Users can create their own expenses
CREATE POLICY "Users can create expenses"
  ON public.hr_expenses FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

-- Users can update their own pending expenses, managers can update any
CREATE POLICY "Users can update own pending expenses"
  ON public.hr_expenses FOR UPDATE
  USING (
    submitted_by = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
  );

-- Only admins can delete
CREATE POLICY "Admins can delete expenses"
  ON public.hr_expenses FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

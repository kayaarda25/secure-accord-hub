-- Auto-approve OPEX requests on creation (removes manual approval workflow)

-- 1) Trigger function
CREATE OR REPLACE FUNCTION public.opex_auto_approve_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Always mark as finance-approved on creation
  NEW.status := 'approved_finance';
  NEW.finance_approver_id := COALESCE(NEW.finance_approver_id, NEW.submitted_by);
  NEW.finance_approved_at := COALESCE(NEW.finance_approved_at, now());

  -- Clear supervisor stage fields (workflow no longer used)
  NEW.supervisor_id := NULL;
  NEW.supervisor_approved_at := NULL;
  NEW.supervisor_comment := NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) Trigger
DROP TRIGGER IF EXISTS trg_opex_auto_approve_on_insert ON public.opex_expenses;
CREATE TRIGGER trg_opex_auto_approve_on_insert
BEFORE INSERT ON public.opex_expenses
FOR EACH ROW
EXECUTE FUNCTION public.opex_auto_approve_on_insert();

-- 3) One-time backfill in Test: convert existing pending requests to approved
UPDATE public.opex_expenses
SET
  status = 'approved_finance',
  finance_approver_id = COALESCE(finance_approver_id, submitted_by),
  finance_approved_at = COALESCE(finance_approved_at, submitted_at),
  updated_at = now(),
  supervisor_id = NULL,
  supervisor_approved_at = NULL,
  supervisor_comment = NULL
WHERE status = 'pending';

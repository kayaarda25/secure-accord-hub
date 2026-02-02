-- Create table for OPEX expense notes/comments
CREATE TABLE public.opex_expense_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.opex_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opex_expense_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view notes for their accessible expenses"
ON public.opex_expense_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM opex_expenses e
    WHERE e.id = expense_id
    AND (
      e.submitted_by = auth.uid()
      OR e.supervisor_id = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'state'::app_role])
    )
  )
);

CREATE POLICY "Users can add notes to expenses they can view"
ON public.opex_expense_notes
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM opex_expenses e
    WHERE e.id = expense_id
    AND (
      e.submitted_by = auth.uid()
      OR e.supervisor_id = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'state'::app_role])
    )
  )
);

CREATE POLICY "Users can update their own notes"
ON public.opex_expense_notes
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes"
ON public.opex_expense_notes
FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_opex_expense_notes_updated_at
BEFORE UPDATE ON public.opex_expense_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_opex_expense_notes_expense_id ON public.opex_expense_notes(expense_id);
CREATE INDEX idx_opex_expense_notes_user_id ON public.opex_expense_notes(user_id);
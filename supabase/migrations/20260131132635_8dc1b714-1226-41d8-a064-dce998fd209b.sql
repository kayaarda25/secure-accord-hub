-- Add DELETE policy for opex_expenses
-- Users can delete their own pending expenses

CREATE POLICY "Users can delete own pending OPEX" 
ON public.opex_expenses 
FOR DELETE 
USING (submitted_by = auth.uid() AND status = 'pending');
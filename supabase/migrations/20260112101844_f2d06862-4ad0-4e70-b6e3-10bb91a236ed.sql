-- Add category column to opex_expenses table
ALTER TABLE public.opex_expenses 
ADD COLUMN category text;

-- Create expense categories enum type for validation
COMMENT ON COLUMN public.opex_expenses.category IS 'Expense category: salaries, rent, insurance, transportation, it, utilities, maintenance, marketing, training, other';
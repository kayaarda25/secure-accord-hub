-- Create declarations table
CREATE TABLE public.declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_number TEXT NOT NULL,
  country TEXT NOT NULL,
  declaration_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- MGI Traffic Data
  mgi_incoming_revenue JSONB DEFAULT '{}'::jsonb,
  mgi_outgoing_cost JSONB DEFAULT '{}'::jsonb,
  opex_mgi NUMERIC DEFAULT 0,
  
  -- GIA Traffic Data
  gia_outgoing_revenue JSONB DEFAULT '{}'::jsonb,
  gia_incoming_cost JSONB DEFAULT '{}'::jsonb,
  opex_gia NUMERIC DEFAULT 0,
  
  -- Margin calculations
  grx_fiscalization NUMERIC DEFAULT 0,
  network_management_system NUMERIC DEFAULT 0,
  margin_split_infosi NUMERIC DEFAULT 30,
  margin_split_mgi NUMERIC DEFAULT 70,
  
  -- Calculated totals (stored for reporting)
  total_mgi_balance NUMERIC DEFAULT 0,
  total_gia_balance NUMERIC DEFAULT 0,
  margin_held NUMERIC DEFAULT 0,
  
  notes TEXT,
  
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for declaration numbers
CREATE SEQUENCE IF NOT EXISTS declaration_number_seq START 1;

-- Create function to generate declaration number
CREATE OR REPLACE FUNCTION public.generate_declaration_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.declaration_number = 'DECL-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('declaration_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-generating declaration number
CREATE TRIGGER set_declaration_number
  BEFORE INSERT ON public.declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_declaration_number();

-- Create trigger for updating updated_at
CREATE TRIGGER update_declarations_updated_at
  BEFORE UPDATE ON public.declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.declarations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can submit declarations"
  ON public.declarations
  FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view declarations based on role"
  ON public.declarations
  FOR SELECT
  USING (
    submitted_by = auth.uid() OR
    has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'state'::app_role, 'admin'::app_role])
  );

CREATE POLICY "Users can update own pending declarations"
  ON public.declarations
  FOR UPDATE
  USING (
    (submitted_by = auth.uid() AND status = 'draft') OR
    has_any_role(auth.uid(), ARRAY['finance'::app_role, 'management'::app_role, 'admin'::app_role])
  );

CREATE POLICY "Admins can delete declarations"
  ON public.declarations
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
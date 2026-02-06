-- Create carrier rates table for mobile provider rates (MGI Media only)
CREATE TABLE public.carrier_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_name TEXT NOT NULL,
  country TEXT NOT NULL,
  inbound_rate NUMERIC NOT NULL DEFAULT 0,
  outbound_rate NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;

-- Only MGI Media users with finance/admin/management roles can manage carrier rates
CREATE POLICY "MGI Media finance can view carrier rates"
ON public.carrier_rates
FOR SELECT
USING (
  get_user_org_type(auth.uid()) = 'mgi_media'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
);

CREATE POLICY "MGI Media finance can create carrier rates"
ON public.carrier_rates
FOR INSERT
WITH CHECK (
  get_user_org_type(auth.uid()) = 'mgi_media'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
);

CREATE POLICY "MGI Media finance can update carrier rates"
ON public.carrier_rates
FOR UPDATE
USING (
  get_user_org_type(auth.uid()) = 'mgi_media'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
);

CREATE POLICY "MGI Media finance can delete carrier rates"
ON public.carrier_rates
FOR DELETE
USING (
  get_user_org_type(auth.uid()) = 'mgi_media'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'management'::app_role, 'finance'::app_role])
);

-- Add trigger for updated_at
CREATE TRIGGER update_carrier_rates_updated_at
BEFORE UPDATE ON public.carrier_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_carrier_rates_country ON public.carrier_rates(country);
CREATE INDEX idx_carrier_rates_organization ON public.carrier_rates(organization_id);
CREATE INDEX idx_carrier_rates_active ON public.carrier_rates(is_active) WHERE is_active = true;